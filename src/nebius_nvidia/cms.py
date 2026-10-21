"""Medicare Local Coverage Determinations (LCDs) from the CMS Coverage API.

https://api.coverage.cms.gov is free and keyless. The LCD list needs no token;
LCD text and revision history need a license token from
/v1/metadata/license-agreement/. Requesting one accepts the AMA CPT, ADA CDT and
AHA UB-04 license agreements for personal, non-commercial use; the project
owner accepted these for the hackathon demo (see README). Tokens last an hour.

We never request AMA code descriptors (e.g. the /hcpc-code endpoints): CPT is
shown as bare codes only.

Fetched text is cached under .cache/policies/ (gitignored, never committed).
"""

import time
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

import httpx

from nebius_nvidia.models import PolicyDoc
from nebius_nvidia.text import html_to_text

CMS_API = "https://api.coverage.cms.gov/v1"
CACHE_DIR = Path(".cache/policies")
TOKEN_TTL_S = 55 * 60  # tokens are valid for one hour; refresh a little early

# LCD fields that carry policy content, in reading order, with display headings.
LCD_SECTIONS = {
    "indication": "Coverage Indications, Limitations, and/or Medical Necessity",
    "associated_info": "Documentation Requirements",
    "doc_reqs": "Documentation Requirements (additional)",
    "util_guide": "Utilization Guidelines",
    "coding_guidelines": "Coding Guidelines",
}


class PolicyNotFound(LookupError):
    pass


def _parse_date(s: str | None) -> date | None:
    return datetime.strptime(s.strip(), "%m/%d/%Y").date() if s and s.strip() else None


def lcd_url(lcd_id: int, version: int) -> str:
    return f"https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid={lcd_id}&ver={version}"


def select_version(docs: list[PolicyDoc], dos: date) -> PolicyDoc:
    """The version in effect on the date of service.

    Bounds are inclusive. If several versions cover the date (CMS sometimes
    republishes with the same effective date), the highest version wins: it is
    the latest publication.
    """
    matches = [d for d in docs if d.in_effect_on(dos)]
    if not matches:
        spans = ", ".join(f"v{d.version} {d.effective_from}–{d.effective_to or 'present'}" for d in docs)
        raise PolicyNotFound(f"No version in effect on {dos}. Known versions: {spans or 'none'}")
    return max(matches, key=lambda d: int(d.version))


def lcd_from_row(row: dict, fetched_at: datetime | None = None) -> PolicyDoc:
    """Build a PolicyDoc from one /v1/data/lcd/ row."""
    lcd_id, version = int(row["lcd_id"]), int(row["lcd_version"])
    parts = []
    for field, heading in LCD_SECTIONS.items():
        body = html_to_text(row.get(field))
        if body:
            parts.append(f"{heading}\n\n{body}")
    return PolicyDoc(
        source="cms-lcd",
        policy_id=f"L{lcd_id}",
        version=str(version),
        title=row["title"],
        effective_from=_parse_date(row.get("rev_eff_date")),
        # A retired LCD's last version may have no rev_end_date; its retirement date ends it.
        effective_to=_parse_date(row.get("rev_end_date")) or _parse_date(row.get("date_retired")),
        retired=row.get("status") == "R",
        version_basis="api-versioned",
        url=lcd_url(lcd_id, version),
        fetched_at=fetched_at or datetime.now(),
        fetched_via="cms-api",
        text="\n\n".join(parts),
    )


class CmsCoverage:
    def __init__(self, http: httpx.Client | None = None, cache_dir: Path | None = CACHE_DIR):
        self._http = http or httpx.Client(base_url=CMS_API, timeout=30)
        self._cache = cache_dir
        self._token: str | None = None
        self._token_at = 0.0
        self._lcds: list[dict] | None = None

    # --- transport -----------------------------------------------------------

    def _auth(self) -> dict:
        if not self._token or time.time() - self._token_at > TOKEN_TTL_S:
            r = self._http.get("/metadata/license-agreement/")
            r.raise_for_status()
            self._token = r.json()["data"][0]["Token"]
            self._token_at = time.time()
        return {"Authorization": f"Bearer {self._token}"}

    def _get(self, path: str, params: dict | None = None, licensed: bool = False) -> list[dict]:
        r = self._http.get(path, params=params, headers=self._auth() if licensed else None)
        r.raise_for_status()
        return r.json()["data"]

    # --- queries -------------------------------------------------------------

    def list_lcds(self) -> list[dict]:
        """Every final LCD at its current version (retired ones included). No token needed."""
        if self._lcds is None:
            self._lcds = self._get("/reports/local-coverage-final-lcds/")
        return self._lcds

    def find_lcds(self, keyword: str, include_retired: bool = False) -> list[dict]:
        kw = keyword.lower()
        return [
            r for r in self.list_lcds()
            if kw in r["title"].lower() and (include_retired or r.get("note") != "Retired")
        ]

    def current_version(self, lcd_id: int) -> int:
        row = next((r for r in self.list_lcds() if int(r["document_id"]) == lcd_id), None)
        if row is None:
            raise PolicyNotFound(f"L{lcd_id} is not in the CMS LCD list")
        return int(row["document_version"])

    def versions(self, lcd_id: int) -> list[int]:
        """All versions with a revision-history entry, plus the current one, newest first."""
        current = self.current_version(lcd_id)
        rows = self._get("/data/lcd/revision-history", {"lcdid": lcd_id, "ver": current}, licensed=True)
        return sorted({int(r["lcd_version"]) for r in rows} | {current}, reverse=True)

    def lcd(self, lcd_id: int, version: int, fresh: bool = False) -> PolicyDoc:
        """One LCD version. fresh=True skips the cache (used to re-verify sources before export)."""
        cached = self._cache / f"L{lcd_id}_v{version}.json" if self._cache else None
        if cached and cached.exists() and not fresh:
            return PolicyDoc.model_validate_json(cached.read_text())
        rows = self._get("/data/lcd/", {"lcdid": lcd_id, "ver": version}, licensed=True)
        if not rows:
            raise PolicyNotFound(f"L{lcd_id} v{version} does not exist")
        doc = lcd_from_row(rows[0])
        if cached:
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_text(doc.model_dump_json(indent=1, exclude={"sha256"}))
        return doc

    def lcd_on(self, lcd_id: int, dos: date, fresh: bool = False) -> PolicyDoc:
        """The version of an LCD in effect on the date of service."""
        docs = []
        for v in self.versions(lcd_id):
            try:
                doc = self.lcd(lcd_id, v, fresh=fresh)
            except PolicyNotFound:
                continue  # revision history can list versions the data endpoint no longer serves
            docs.append(doc)
            if doc.in_effect_on(dos):
                break  # newest first, so the first match is the latest publication
            if doc.effective_to and doc.effective_to < dos:
                break  # older versions can't cover a later date
        return select_version(docs, dos)


@lru_cache(maxsize=1)
def cms() -> CmsCoverage:
    return CmsCoverage()
