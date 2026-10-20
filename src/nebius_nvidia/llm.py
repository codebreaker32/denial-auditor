"""Nebius Token Factory inference (OpenAI-compatible API).

The API key is read from the NEBIUS_TOKEN_FACTORY_KEY environment variable,
loaded from .env in development. Never hardcode or log the key.
"""

import os
from functools import lru_cache

import httpx
from dotenv import load_dotenv
from openai import OpenAI

from nebius_nvidia.budget import BudgetTransport

load_dotenv(".env.local")
load_dotenv(".env")

BASE_URL = "https://api.tokenfactory.nebius.com/v1/"

# NVIDIA open source models served on Token Factory. Use ULTRA for heavy
# reasoning, NANO/SUPER for fast everyday calls.
NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
SUPER = "nvidia/nemotron-3-super-120b-a12b"
ULTRA = "nvidia/Nemotron-3-Ultra-550b-a55b"


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
