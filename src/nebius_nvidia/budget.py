"""Hard spend caps for Nebius Token Factory (USD) and Tavily (credits).

Token Factory: every request made through llm() passes through BudgetTransport, which:
  1. refuses the request if the worst-case cost (estimated prompt + max_tokens
     of completion) would push cumulative spend over the cap, and
  2. records the actual cost from the response's `usage` field.

Spend is kept in a JSON ledger on disk (file-locked, so concurrent processes
on one machine share it). Prices come from GET /v1/models?verbose=true.

Tavily: every call made through web.client() goes through GuardedTavily, which
refuses the call if its worst-case credit cost would exceed the cap, then
records the actual credits from the response (include_usage=True), falling
back to the worst case when the response doesn't report them.

Config (env / .env):
  TOKEN_FACTORY_BUDGET_USD  cap in USD, default 27
  TOKEN_FACTORY_LEDGER      ledger path, default .token_factory_spend.json
  TAVILY_CREDIT_CAP         cap in credits, default 4125
  TAVILY_CREDITS_PRIOR      credits already used before the ledger existed, default 7
  TAVILY_LEDGER             ledger path, default .tavily_spend.json
"""

import fcntl
import json
import math
import os
from contextlib import contextmanager
from functools import lru_cache

import httpx

DEFAULT_CAP_USD = 27.0
# Used for the worst-case estimate when a request sets no max_tokens.
ASSUMED_MAX_TOKENS = 8192
# Rough chars-per-token for the prompt estimate; deliberately low (pessimistic).
CHARS_PER_TOKEN = 3


class BudgetExceeded(RuntimeError):
    pass


def cap_usd() -> float:
    return float(os.environ.get("TOKEN_FACTORY_BUDGET_USD", DEFAULT_CAP_USD))


def ledger_path() -> str:
    return os.environ.get("TOKEN_FACTORY_LEDGER", ".token_factory_spend.json")


@contextmanager
def _locked_json(path: str, default: dict):
    """Yield a JSON dict under an exclusive lock; changes are saved on exit."""
    with open(path, "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            f.seek(0)
            raw = f.read()
            data = json.loads(raw) if raw.strip() else default
            yield data
            f.seek(0)
            f.truncate()
            json.dump(data, f, indent=2)
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def _ledger():
    return _locked_json(ledger_path(), {"spent_usd": 0.0, "by_model": {}})


def spent_usd() -> float:
    with _ledger() as data:
        return data["spent_usd"]


@lru_cache(maxsize=1)
def _prices(base_url: str, api_key: str) -> dict[str, tuple[float, float]]:
    """Return {model_id: (usd_per_prompt_token, usd_per_completion_token)}."""
    r = httpx.get(
        f"{base_url.rstrip('/')}/models",
        params={"verbose": "true"},
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    r.raise_for_status()
    return {
        m["id"]: (float(m["pricing"]["prompt"]), float(m["pricing"]["completion"]))
        for m in r.json()["data"]
        if m.get("pricing")
    }


class BudgetTransport(httpx.BaseTransport):
    def __init__(self, base_url: str, api_key: str):
        self._inner = httpx.HTTPTransport()
        self._base_url = base_url
        self._api_key = api_key

    def _price(self, model: str) -> tuple[float, float]:
        prices = _prices(self._base_url, self._api_key)
        if model not in prices:
            raise BudgetExceeded(f"No price known for model {model!r}; refusing to call it")
        return prices[model]

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        if request.method != "POST":
            return self._inner.handle_request(request)

        body = json.loads(request.content or b"{}")
        if body.get("stream"):
            raise BudgetExceeded("Streaming is not supported by the budget guard yet")
        model = body.get("model", "")
        prompt_price, completion_price = self._price(model)

        max_out = body.get("max_tokens") or body.get("max_completion_tokens") or ASSUMED_MAX_TOKENS
        est_prompt = len(request.content) / CHARS_PER_TOKEN
        worst_case = est_prompt * prompt_price + max_out * completion_price

        cap = cap_usd()
        with _ledger() as data:
            if data["spent_usd"] + worst_case > cap:
                raise BudgetExceeded(
                    f"Token Factory budget: ${data['spent_usd']:.4f} spent of ${cap:.2f}; "
                    f"this call could cost up to ${worst_case:.4f}"
                )

        response = self._inner.handle_request(request)
        response.read()
        if response.status_code == 200:
            usage = response.json().get("usage") or {}
            cost = (
                usage.get("prompt_tokens", 0) * prompt_price
                + usage.get("completion_tokens", 0) * completion_price
            )
            with _ledger() as data:
                data["spent_usd"] += cost
                data["by_model"][model] = data["by_model"].get(model, 0.0) + cost
        return response

    def close(self) -> None:
        self._inner.close()


# --- Tavily -----------------------------------------------------------------

DEFAULT_TAVILY_CAP = 4125
DEFAULT_TAVILY_PRIOR = 7
# Worst case for research when the response doesn't say (Tavily's pro tier max).
RESEARCH_WORST_CASE = 250


def tavily_cap() -> int:
    return int(os.environ.get("TAVILY_CREDIT_CAP", DEFAULT_TAVILY_CAP))


def _tavily_ledger():
    prior = int(os.environ.get("TAVILY_CREDITS_PRIOR", DEFAULT_TAVILY_PRIOR))
    return _locked_json(
        os.environ.get("TAVILY_LEDGER", ".tavily_spend.json"),
        {"credits_used": prior, "prior": prior, "by_method": {}},
    )


def tavily_credits_used() -> float:
    with _tavily_ledger() as data:
        return data["credits_used"]


def _tavily_worst_case(method: str, kwargs: dict) -> float:
    """Upper bound on credits for one call, from Tavily's published pricing."""
    advanced = 2 if "advanced" in (kwargs.get("search_depth"), kwargs.get("extract_depth")) else 1
    if method == "search":
        return advanced
    if method == "extract":
        urls = kwargs.get("urls") or []
        n = 1 if isinstance(urls, str) else len(urls)
        return math.ceil(n / 5) * advanced
    pages = kwargs.get("limit") or 50
    mapping = math.ceil(pages / 10) * (2 if kwargs.get("instructions") else 1)
    if method == "map":
        return mapping
    if method == "crawl":
        return mapping + math.ceil(pages / 5) * advanced
    return RESEARCH_WORST_CASE


class GuardedTavily:
    """Wraps a TavilyClient; search/extract/crawl/map/research are credit-capped."""

    GUARDED = {"search", "extract", "crawl", "map", "research"}

    def __init__(self, inner):
        self._inner = inner

    def __getattr__(self, name):
        attr = getattr(self._inner, name)
        if name not in self.GUARDED:
            return attr

        def guarded(*args, **kwargs):
            if args:
                raise TypeError(f"Pass arguments to {name}() by keyword so cost can be estimated")
            worst = _tavily_worst_case(name, kwargs)
            cap = tavily_cap()
            with _tavily_ledger() as data:
                if data["credits_used"] + worst > cap:
                    raise BudgetExceeded(
                        f"Tavily budget: {data['credits_used']} of {cap} credits used; "
                        f"this {name} call could cost up to {worst}"
                    )
            response = attr(include_usage=True, **kwargs)
            credits = (response.get("usage") or {}).get("credits")
            cost = worst if credits is None else credits
            with _tavily_ledger() as data:
                data["credits_used"] += cost
                data["by_method"][name] = data["by_method"].get(name, 0) + cost
            return response

        return guarded
