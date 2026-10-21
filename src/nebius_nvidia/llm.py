"""Nebius Token Factory inference (OpenAI-compatible API).

The API key is read from the NEBIUS_TOKEN_FACTORY_KEY environment variable,
loaded from .env in development. Never hardcode or log the key.
"""

import json
import os
import re
import time
from functools import lru_cache
from typing import Literal, TypeVar

import httpx
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from nebius_nvidia.budget import BudgetTransport, prices
from nebius_nvidia.models import StepTrace

load_dotenv(".env.local")
load_dotenv(".env")

BASE_URL = "https://api.tokenfactory.nebius.com/v1/"

# NVIDIA open source models served on Token Factory. Use ULTRA for heavy
# reasoning, NANO/SUPER for fast everyday calls.
NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
SUPER = "nvidia/nemotron-3-super-120b-a12b"
ULTRA = "nvidia/Nemotron-3-Ultra-550b-a55b"
LIGHTNING = "nvidia/Nemotron-3_5-Lightning"  # 1M context: whole policies in one pass
SUPER_VL = "nvidia/Nemotron-3.5-Super-VL"  # text + image: scanned denial letters


@lru_cache(maxsize=1)
def llm() -> OpenAI:
    """Return a cached, budget-capped Token Factory client (see budget.py).

    Always go through this client; calls made any other way bypass the cap.
    """
    key = os.environ.get("NEBIUS_TOKEN_FACTORY_KEY")
    if not key:
        raise RuntimeError(
            "NEBIUS_TOKEN_FACTORY_KEY is not set. Copy .env.example to .env "
            "and add your key, or export it in the environment."
        )
    http_client = httpx.Client(transport=BudgetTransport(BASE_URL, key), timeout=600)
    # max_retries=0: SDK retries would re-enter the transport anyway, but keep
    # failures visible rather than silently re-spending.
    return OpenAI(base_url=BASE_URL, api_key=key, http_client=http_client, max_retries=0)


def chat(prompt: str, model: str = NANO, system: str | None = None, **kwargs) -> str:
    """Send one user prompt and return the reply text.

    Nemotron 3 models reason first; the trace comes back separately in
    message.reasoning and can occasionally leave content empty, so this raises
    rather than returning None.
    """
    messages = [{"role": "system", "content": system}] if system else []
    messages.append({"role": "user", "content": prompt})
    response = llm().chat.completions.create(model=model, messages=messages, **kwargs)
    choice = response.choices[0]
    if not choice.message.content:
        raise RuntimeError(
            f"{model} returned no content (finish_reason={choice.finish_reason}); "
            "raise max_tokens or retry"
        )
    return choice.message.content.strip()


# --- Structured output --------------------------------------------------------

OutputMode = Literal["json_schema", "json_object", "prompt_only"]

# How each model returns JSON reliably on Token Factory. scripts/probe_models.py
# (2026-10-21): all five returned correct JSON in json_schema, json_object and
# prompt_only modes. Unknown models fall back to prompt_only.
MODEL_CAPS: dict[str, OutputMode] = {
    NANO: "json_schema",
    SUPER: "json_schema",
    ULTRA: "json_schema",
    LIGHTNING: "json_schema",
    SUPER_VL: "json_schema",
}

MAX_TOKENS_CEILING = 32768

T = TypeVar("T", bound=BaseModel)


class LLMFormatError(RuntimeError):
    pass


def price_of(model: str) -> tuple[float, float]:
    """(USD per prompt token, USD per completion token) for a Token Factory model."""
    return prices(BASE_URL, os.environ["NEBIUS_TOKEN_FACTORY_KEY"]).get(model, (0.0, 0.0))


def _extract_json(content: str) -> str:
    """Pull a JSON object out of model output (code fences, leading prose, trailing text)."""
    s = content.strip()
    if s.startswith("{") and s.endswith("}"):
        return s
    fenced = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", s, flags=re.S)
    if fenced:
        return fenced[-1]
    # Last balanced top-level {...} block, ignoring braces inside strings.
    last, depth, start, in_str, esc = None, 0, None, False, False
    for i, ch in enumerate(s):
        if in_str:
            esc = (ch == "\\") and not esc
            if ch == '"' and not esc:
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth:
            depth -= 1
            if depth == 0:
                last = s[start : i + 1]
    return last or s


def _schema_prompt(schema: type[BaseModel]) -> str:
    return (
        "Respond with a single JSON object that conforms to this JSON Schema. "
        "Output only the JSON object, with no prose and no code fences.\n\n"
        + json.dumps(schema.model_json_schema())
    )


def structured(
    model: str,
    messages: list[dict],
    schema: type[T],
    *,
    max_tokens: int,
    step: str,
    tracker=None,
    thinking: bool | None = None,
    client: OpenAI | None = None,
) -> T:
    """Call a model and return its output validated against `schema`.

    - The schema always goes in the system prompt; response_format is added when
      MODEL_CAPS says the model honours it.
    - Empty content (reasoning used the token budget) → one retry with 2× max_tokens.
    - Invalid JSON / schema mismatch → one repair retry quoting the error.
    - Then LLMFormatError. Every attempt goes through the budget-capped client.
    """
    client = client or llm()
    mode = MODEL_CAPS.get(model, "prompt_only")
    msgs = [{"role": "system", "content": _schema_prompt(schema)}, *messages]
    kwargs: dict = {}
    if mode == "json_schema":
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": schema.__name__, "schema": schema.model_json_schema()},
        }
    elif mode == "json_object":
        kwargs["response_format"] = {"type": "json_object"}
    if thinking is not None:
        kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": thinking}}

    trace = StepTrace(step=step, model=model, attempts=0)
    t0 = time.time()
    tokens = max_tokens
    retried_empty = repaired = False
    last_error = ""
    try:
        while True:
            trace.attempts += 1
            r = client.chat.completions.create(model=model, messages=msgs, max_tokens=tokens, **kwargs)
            if r.usage:
                trace.prompt_tokens += r.usage.prompt_tokens or 0
                trace.completion_tokens += r.usage.completion_tokens or 0
            choice = r.choices[0]
            content = (choice.message.content or "").strip()

            if not content:
                last_error = f"empty content (finish_reason={choice.finish_reason})"
                if retried_empty or tokens >= MAX_TOKENS_CEILING:
                    break
                retried_empty = True
                tokens = min(tokens * 2, MAX_TOKENS_CEILING)
                continue

            try:
                return schema.model_validate_json(_extract_json(content))
            except ValidationError as e:
                last_error = str(e)[:1500]
                if repaired:
                    break
                repaired = True
                msgs = [
                    *msgs,
                    {"role": "assistant", "content": content[:4000]},
                    {"role": "user", "content": f"That output was invalid:\n{last_error}\nReturn only the corrected JSON object."},
                ]
        raise LLMFormatError(f"{step}: {model} gave no valid output after {trace.attempts} attempts: {last_error}")
    finally:
        trace.latency_s = round(time.time() - t0, 2)
        if tracker is not None:
            try:
                p, c = price_of(model)
            except KeyError:  # no key in tests; cost stays 0
                p, c = 0.0, 0.0
            trace.cost_usd = round(trace.prompt_tokens * p + trace.completion_tokens * c, 6)
            tracker.record(trace)
