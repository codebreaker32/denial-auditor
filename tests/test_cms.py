from datetime import date, datetime

import httpx
import pytest

from nebius_nvidia.cms import CmsCoverage, PolicyNotFound, lcd_from_row, select_version
from nebius_nvidia.text import locate


@pytest.fixture
def cms_client(cms_fixture, tmp_path):
    """CmsCoverage backed by a MockTransport that serves the saved CMS responses."""
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req.url.path)
        p, q = req.url.path, req.url.params
        if p.endswith("/metadata/license-agreement/"):
            return httpx.Response(200, json={"data": [{"Token": "test-token"}]})
        if p.endswith("/reports/local-coverage-final-lcds/"):
            return httpx.Response(200, json={"data": cms_fixture["list"]})
        assert req.headers.get("Authorization") == "Bearer test-token"
        if p.endswith("/data/lcd/revision-history"):
            return httpx.Response(200, json={"data": cms_fixture["rev_L34220"]})
        if p.endswith("/data/lcd/"):
            rows = cms_fixture.get(f"L{q['lcdid']}_v{q['ver']}", [])
            return httpx.Response(200, json={"data": rows})
        return httpx.Response(404)

    http = httpx.Client(base_url="https://api.coverage.cms.gov/v1", transport=httpx.MockTransport(handler))
    c = CmsCoverage(http=http, cache_dir=tmp_path)
    c.calls = calls
    return c


def _doc(version, eff, end=None):
    return lcd_from_row(
        {"lcd_id": "1", "lcd_version": str(version), "title": "t", "rev_eff_date": eff,
         "rev_end_date": end or "", "status": "A", "indication": "x"},
        fetched_at=datetime(2026, 10, 21),
    )


def test_lcd_from_row_v40(cms_fixture):
    doc = lcd_from_row(cms_fixture["L34220_v40"][0])
    assert doc.policy_id == "L34220" and doc.version == "40"
    assert doc.effective_from == date(2025, 10, 23) and doc.effective_to is None
    assert doc.citation().startswith("L34220 v40, eff 10/23/2025")
    # The demo criteria are present verbatim in the cleaned text.
    assert locate("conservative management lasting at least four weeks", doc.text)
    assert locate("Saddle anesthesia", doc.text)
    assert "&lt;" not in doc.text and "<p>" not in doc.text


def test_retired_lcd_ends_at_retirement(cms_fixture):
    doc = lcd_from_row(cms_fixture["L37281_v23"][0])
    assert doc.retired and doc.effective_to == date(2025, 10, 23)


@pytest.mark.parametrize(
    "dos,expected",
    [(date(2025, 10, 22), "37"), (date(2025, 10, 23), "40"), (date(2026, 8, 14), "40"), (date(2022, 8, 18), "37")],
)
def test_select_version_inclusive_bounds(dos, expected):
    docs = [_doc(40, "10/23/2025"), _doc(37, "08/18/2022", "10/22/2025")]
    assert select_version(docs, dos).version == expected


def test_select_version_overlap_highest_wins():
    docs = [_doc(24, "10/01/2018"), _doc(26, "10/01/2018"), _doc(28, "10/01/2018")]
    assert select_version(docs, date(2019, 1, 1)).version == "28"


def test_select_version_gap_raises():
    with pytest.raises(PolicyNotFound):
        select_version([_doc(40, "10/23/2025")], date(2025, 1, 1))


def test_lcd_on_picks_version_by_dos(cms_client):
    assert cms_client.lcd_on(34220, date(2026, 8, 14)).version == "40"
    assert cms_client.lcd_on(34220, date(2024, 6, 2)).version == "37"


def test_lcd_on_stops_early_and_caches(cms_client):
    cms_client.lcd_on(34220, date(2026, 8, 14))
    first = len(cms_client.calls)
    assert cms_client.calls.count("/v1/data/lcd/") == 1  # v40 matched; no older versions fetched
    cms_client.lcd_on(34220, date(2026, 8, 14))
    assert cms_client.calls[first:].count("/v1/data/lcd/") == 0  # served from cache


def test_lcd_fresh_bypasses_cache(cms_client):
    cms_client.lcd(34220, 40)
    cms_client.lcd(34220, 40, fresh=True)
    assert cms_client.calls.count("/v1/data/lcd/") == 2


def test_missing_version_raises(cms_client):
    with pytest.raises(PolicyNotFound):
        cms_client.lcd(34220, 32)  # listed in revision history, but the data endpoint is empty


def test_token_requested_once(cms_client):
    cms_client.lcd(34220, 40)
    cms_client.lcd(34220, 37)
    assert cms_client.calls.count("/v1/metadata/license-agreement/") == 1


def test_find_lcds(cms_client):
    assert [r["document_display_id"] for r in cms_client.find_lcds("lumbar mri")] == ["L34220"]
    assert {r["document_display_id"] for r in cms_client.find_lcds("lumbar mri", include_retired=True)} == {"L34220", "L37281"}
