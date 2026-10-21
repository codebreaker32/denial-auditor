from datetime import date

import pytest

from nebius_nvidia.rules import RULES, deadline

NOTICE = date(2026, 9, 1)


@pytest.mark.parametrize(
    "plan,due",
    [
        ("MA", date(2026, 11, 5)),  # 5-day receipt presumption + 60 days
        ("MEDICARE_FFS", date(2027, 1, 4)),  # 5 + 120
        ("COMMERCIAL_ACA", date(2027, 2, 28)),  # 180 from the notice (conservative)
        ("COMMERCIAL_ERISA", date(2027, 2, 28)),
    ],
)
def test_due_dates(plan, due):
    d = deadline(plan, NOTICE, today=date(2026, 10, 21))
    assert d.due == due
    assert d.days_left == (due - date(2026, 10, 21)).days
    assert d.verified and d.citation and d.source_url.startswith("https://www.ecfr.gov/")


@pytest.mark.parametrize("plan", ["MEDICAID", "UNKNOWN"])
def test_unknown_plan_is_unverified_not_guessed(plan):
    d = deadline(plan, NOTICE)
    assert d.due is None and d.days_left is None and not d.verified
    assert "denial notice" in d.basis


def test_overdue_is_negative():
    assert deadline("MA", date(2026, 1, 1), today=date(2026, 10, 21)).days_left < 0


def test_every_rule_has_a_source():
    for r in RULES.values():
        assert r.citation and r.source_url and r.verified_on
