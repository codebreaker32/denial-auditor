"""Tavily web access.

The API key is read from the TAVILY_API_KEY environment variable, loaded from
.env in development. Never hardcode or log the key.
"""

import os
from functools import lru_cache

from dotenv import load_dotenv
from tavily import TavilyClient

from nebius_nvidia.budget import GuardedTavily

# .env.local wins if present; otherwise .env. Neither is committed.
load_dotenv(".env.local")
load_dotenv(".env")


@lru_cache(maxsize=1)
def client() -> GuardedTavily:
    """Return a cached, credit-capped TavilyClient (see budget.py), or raise if
    the key is missing. Always go through this; a bare TavilyClient bypasses the cap.
    """
    if not os.environ.get("TAVILY_API_KEY"):
        raise RuntimeError(
            "TAVILY_API_KEY is not set. Copy .env.example to .env "
            "and add your key, or export it in the environment."
        )
    return GuardedTavily(TavilyClient())


def search(query: str, max_results: int = 5, **kwargs) -> dict:
    """Search the web and return Tavily's raw response."""
    return client().search(query=query, max_results=max_results, **kwargs)
