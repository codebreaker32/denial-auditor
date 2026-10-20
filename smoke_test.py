#!/usr/bin/env python3
"""One real Tavily request and one Token Factory call, end to end."""

import sys

from nebius_nvidia import NANO, chat, search


def main() -> int:
    response = search("Nebius NVIDIA GPU cloud", max_results=3)
    results = response.get("results", [])

    if not results:
        print("FAIL: request succeeded but returned no results")
        return 1

    print(f"OK: {len(results)} results for {response['query']!r}")
    for r in results:
        print(f"  - {r['title'][:70]}")
        print(f"    {r['url']}")

    reply = chat("Reply with exactly: Token Factory OK", model=NANO, max_tokens=1000)
    print(f"OK: {NANO} replied {reply!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
