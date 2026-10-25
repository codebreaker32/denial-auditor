from datetime import date, datetime

from nebius_nvidia.drift import changed_rules, check_one, seconds_until_next_run
from nebius_nvidia.models import Criterion, PolicyDoc


def _doc(version, text, eff):
    return PolicyDoc(source="cms-lcd", policy_id="L34220", version=str(version), title="t", effective_from=eff,
                     effective_to=None, version_basis="api-versioned", url="u", fetched_at=datetime(2026, 10, 1),
                     fetched_via="cms-api", text=text)


CRIT = [Criterion(criterion_id="C1", doc_id="d", summary="four weeks", verbatim_span="at least four weeks", kind="duration", span_verified=True),
        Criterion(criterion_id="C2", doc_id="d", summary="red flags", verbatim_span="red flags include fever", kind="red_flag", span_verified=True)]


def test_changed_rules_names_rules_whose_wording_moved():
    assert [r["criterion_id"] for r in changed_rules(CRIT, "lasting at least six weeks; red flags include fever")] == ["C1"]


class FakeCms:
    def __init__(self, current, doc):
        self._current, self._doc = current, doc

    def current_version(self, lcd):
        return self._current

    def lcd(self, lcd, version):
        return self._doc


def test_newer_version_only_affects_cases_it_covers(monkeypatch):
    import nebius_nvidia.cms as cms_mod

    old = _doc(40, "at least four weeks; red flags include fever", date(2025, 10, 23))
    new = _doc(41, "at least six weeks; red flags include fever", date(2026, 9, 1))
    monkeypatch.setattr(cms_mod, "cms", lambda: FakeCms(41, new))
    before = check_one("case_x", "denial", old, CRIT, date(2026, 8, 1))
    after = check_one("case_y", "prior_auth", old, CRIT, date(2026, 11, 1))
    assert before.status == after.status == "newer_version"
    assert not before.affects_case and after.affects_case
    assert [r["criterion_id"] for r in after.changed_rules] == ["C1"]


def test_current_version_is_quiet(monkeypatch):
    import nebius_nvidia.cms as cms_mod

    old = _doc(40, "x", date(2025, 10, 23))
    monkeypatch.setattr(cms_mod, "cms", lambda: FakeCms(40, old))
    assert check_one("c", "denial", old, CRIT, date(2026, 8, 1)).status == "current"


def test_nightly_schedule():
    assert seconds_until_next_run(datetime(2026, 10, 25, 2, 0)) == 3600
    assert seconds_until_next_run(datetime(2026, 10, 25, 3, 0)) == 24 * 3600
