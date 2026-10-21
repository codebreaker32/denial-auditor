"""Which web sources the pipeline may fetch and send to a model.

eviCore and Carelon guideline terms forbid copying and (Carelon) any AI use;
ACR Appropriateness Criteria are for ACR members' internal use. We link to
them by name only and never fetch, store or prompt with their text.
"""

from urllib.parse import urlparse

# Registered domains (the last two labels of the host, or the host itself).
BLOCKED_DOMAINS = {
    "evicore.com",
    "carelon.com",
    "carelonmedicalbenefitsmanagement.com",
    "acr.org",
}


class BlockedSource(ValueError):
    pass


def _registered_domain(host: str) -> str:
    parts = host.lower().rstrip(".").split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host.lower()


def is_allowed(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return _registered_domain(host) not in BLOCKED_DOMAINS


def assert_allowed(url: str) -> None:
    if not is_allowed(url):
        raise BlockedSource(
            f"{urlparse(url).hostname} content may not be fetched or sent to a model (terms of use); link to it instead"
        )


def filter_results(results: list[dict]) -> list[dict]:
    """Drop blocked sources from Tavily search/extract results (each has a 'url')."""
    return [r for r in results if is_allowed(r.get("url", ""))]
