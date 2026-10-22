"""Aetna Clinical Policy Bulletins (commercial payer), located at runtime with Tavily.

1. Tavily search (restricted to aetna.com) finds the bulletin for the service.
2. The bulletin page is fetched directly and cut to its "Policy" section, which
   ends before the CPT / HCPCS / ICD-10 code tables, so AMA CPT descriptors are
   never stored or shown. (Tavily extract was tried first: on these pages it drops
   the nested criteria list, so the page itself is parsed instead.)
3. Aetna publishes no prior versions, so the document is a dated snapshot:
   version = fetch date, effective_from = Aetna's "Last Review" date.

Aetna content is copyrighted: the app shows short attributed quotes with a link,
and the snapshot is cached locally under .cache/ (gitignored), never committed.
"""

import json
import re
from datetime import date, datetime
from pathlib import Path

import httpx

from nebius_nvidia.models import PolicyDoc
from nebius_nvidia.sources import assert_allowed
from nebius_nvidia.text import html_to_text
from nebius_nvidia.web import client

CACHE_DIR = Path(".cache/policies")
CPB_URL = re.compile(r"https?://(www\.)?aetna\.com/cpb/medical/data/\d+_\d+/(\d{4})\.html")
UA = {"User-Agent": "Mozilla/5.0 (DenialAuditor hackathon demo; policy lookup)"}


class CpbNotFound(LookupError):
    pass


def find_cpb(query: str) -> tuple[str, str]:
    """Locate a bulletin with Tavily. Returns (url, title). Results are cached on disk per query."""
    cache = CACHE_DIR / "aetna_search.json"
    found = json.loads(cache.read_text()) if cache.exists() else {}
    if query in found:
        return tuple(found[query])
    resp = client().search(query=query, include_domains=["aetna.com"], max_results=5)
    for r in resp.get("results", []):
        url = r.get("url", "")
        if CPB_URL.match(url):
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            found[query] = [url, r.get("title", "")]
            cache.write_text(json.dumps(found, indent=1))
            return url, r.get("title", "")
    raise CpbNotFound(f"No Aetna Clinical Policy Bulletin found for {query!r}")


def policy_section(html: str) -> str:
    """The bulletin's Policy section as plain text, stopping before the code tables."""
    start = html.find("Scope of Policy")
    ends = [i for i in (html.find("Related Policies", start), html.find("CPT Codes / HCPCS")) if i > 0]
    end = min(ends) if ends else -1
    if start < 0 or end < 0 or end <= start:
        raise CpbNotFound("Unexpected bulletin layout (Policy section or code tables not found)")
    section = html[start:end]
    section = re.sub(r'<span class="sr-only">.*?</span>', "", section, flags=re.S)  # "Footnote1" screen-reader labels
    section = re.sub(r"<h[1-6][^>]*>", "\n\n", section)
    text = html_to_text(section)
    text = re.sub(r"\n•\s*(?=\n|$)", "", text)  # empty bullets left by layout markup
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def fetch_cpb(url: str, fetched_on: date | None = None) -> PolicyDoc:
    assert_allowed(url)
    m = CPB_URL.match(url)
    if not m:
        raise CpbNotFound(f"Not an Aetna CPB URL: {url}")
    number = m.group(2)
    fetched_on = fetched_on or date.today()
    cached = CACHE_DIR / f"aetna_{number}_{fetched_on:%Y%m%d}.json"
    if cached.exists():
        return PolicyDoc.model_validate_json(cached.read_text())

    r = httpx.get(url, headers=UA, timeout=40, follow_redirects=True)
    r.raise_for_status()
    html = r.text
    title = re.search(r"<title>(.*?)</title>", html, flags=re.S)
    review = re.search(r"Last Review(?:\s|<[^>]*>|&nbsp;)*(\d{2}/\d{2}/\d{4})", html)
    doc = PolicyDoc(
        source="aetna-cpb",
        policy_id=f"Aetna CPB {number}",
        version=f"{fetched_on:%Y-%m-%d}",
        title=html_to_text(title.group(1)).split(" - ")[0] if title else f"Clinical Policy Bulletin {number}",
        effective_from=datetime.strptime(review.group(1), "%m/%d/%Y").date() if review else None,
        effective_to=None,
        version_basis="snapshot-at-fetch",
        url=url,
        fetched_at=datetime.now(),
        fetched_via="http",
        text=policy_section(html),
    )
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached.write_text(doc.model_dump_json(indent=1, exclude={"sha256"}))
    return doc


def lumbar_mri_policy() -> PolicyDoc:
    url, _ = find_cpb("Aetna Clinical Policy Bulletin MRI and CT of the spine")
    return fetch_cpb(url)
