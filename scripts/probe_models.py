#!/usr/bin/env python3
"""Probe Token Factory: advertised features/prices (free) and which structured-output
mode actually works per Nemotron model (a few tiny calls, ~$0.02 total).

Usage: ./.venv/bin/python scripts/probe_models.py
"""

import json
import os
import time

import httpx

from nebius_nvidia.budget import spent_usd
from nebius_nvidia.llm import BASE_URL, LIGHTNING, NANO, SUPER, SUPER_VL, ULTRA, llm

MODELS = [NANO, SUPER, ULTRA, LIGHTNING, SUPER_VL]
SCHEMA = {
    "type": "object",
    "properties": {"city": {"type": "string"}, "weeks": {"type": "integer"}},
    "required": ["city", "weeks"],
    "additionalProperties": False,
}
PROMPT = (
    'Return JSON with keys "city" (the capital of France) and "weeks" (how many weeks are in 28 days). '
    "Output only the JSON object."
)


def advertised() -> dict:
    r = httpx.get(
        f"{BASE_URL.rstrip('/')}/models",
        params={"verbose": "true"},
        headers={"Authorization": f"Bearer {os.environ['NEBIUS_TOKEN_FACTORY_KEY']}"},
        timeout=30,
    )
    r.raise_for_status()
    by_id = {m["id"]: m for m in r.json()["data"]}
    return {
        m: {
            "supported_features": by_id.get(m, {}).get("supported_features"),
            "pricing": by_id.get(m, {}).get("pricing"),
            "context_length": by_id.get(m, {}).get("context_length"),
            "modality": (by_id.get(m, {}).get("architecture") or {}).get("modality"),
        }
        for m in MODELS
    }


def attempt(model: str, mode: str, **extra) -> dict:
    kwargs = {"model": model, "messages": [{"role": "user", "content": PROMPT}], "max_tokens": 1500, **extra}
    if mode == "json_schema":
        kwargs["response_format"] = {"type": "json_schema", "json_schema": {"name": "probe", "schema": SCHEMA, "strict": True}}
    elif mode == "json_object":
        kwargs["response_format"] = {"type": "json_object"}
    t0 = time.time()
    try:
        r = llm().chat.completions.create(**kwargs)
    except Exception as e:  # noqa: BLE001 - probing; record whatever the API says
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}
    c = r.choices[0]
    content = (c.message.content or "").strip()
    try:
        parsed = json.loads(content)
        valid = parsed.get("city") == "Paris" and parsed.get("weeks") == 4
    except (json.JSONDecodeError, AttributeError):
        parsed, valid = None, False
    return {
        "ok": True,
        "valid_json": parsed is not None,
        "correct": valid,
        "finish_reason": c.finish_reason,
        "has_reasoning": bool(getattr(c.message, "reasoning", None) or (c.message.model_extra or {}).get("reasoning")),
        "content_head": content[:80],
        "completion_tokens": r.usage.completion_tokens if r.usage else None,
        "latency_s": round(time.time() - t0, 1),
    }


def main() -> None:
    before = spent_usd()
    report = {"advertised": advertised(), "calls": {}}
    for m in MODELS:
        report["calls"][m] = {mode: attempt(m, mode) for mode in ("json_schema", "json_object", "prompt_only")}
    # Can reasoning be switched off for cheap extraction steps?
    report["calls"][NANO]["prompt_only_no_thinking"] = attempt(
        NANO, "prompt_only", extra_body={"chat_template_kwargs": {"enable_thinking": False}}
    )
    report["spent_usd"] = round(spent_usd() - before, 5)
    os.makedirs(".cache", exist_ok=True)
    with open(".cache/model_probe.json", "w") as f:
        json.dump(report, f, indent=1, default=str)
    print(json.dumps(report, indent=1, default=str))


if __name__ == "__main__":
    main()
