import pytest

from nebius_nvidia.match import adjust, verdict
from nebius_nvidia.models import Criterion, CriterionMatch, TriageResult

CLINICAL = TriageResult(reason_class="clinical", route="clinical_review", method="carc_table")


def case(*rules):
    """rules: (kind, status) pairs → (criteria, matches)."""
    crit = [Criterion(criterion_id=f"C{i}", doc_id="d", summary="s", verbatim_span="x", kind=k)
            for i, (k, _) in enumerate(rules)]
    matches = [CriterionMatch(criterion_id=f"C{i}", status=s, rationale="r") for i, (_, s) in enumerate(rules)]
    return crit, matches


@pytest.mark.parametrize(
    "rules,expected",
    [
        # Conservative-care route met; red-flag route unused → appeal.
        ([("indication", "not_met"), ("duration", "met"), ("exclusion", "not_applicable")], "appeal"),
        # Red-flag route met; no-red-flag duration rule not applicable → appeal.
        ([("red_flag", "met"), ("duration", "not_applicable")], "appeal"),
        # A restriction or duration rule fails → don't appeal.
        ([("duration", "not_met"), ("indication", "met")], "dont_appeal"),
        ([("exclusion", "not_met"), ("duration", "met")], "dont_appeal"),
        # Aetna: the only route (an indication) isn't met and nothing else qualifies → don't appeal yet.
        ([("indication", "not_met"), ("indication", "not_applicable")], "dont_appeal"),
        # Something undocumented → ask the physician.
        ([("duration", "met"), ("documentation", "missing_documentation")], "doc_request"),
        # Aetna: the only route fails on duration; another rule undocumented → still don't appeal yet.
        ([("indication", "not_met"), ("documentation", "missing_documentation")], "dont_appeal"),
        # An undocumented alternative route doesn't trigger a physician request.
        ([("duration", "met"), ("indication", "missing_documentation")], "appeal"),
        # Nothing decisive → ask.
        ([("exclusion", "not_applicable")], "doc_request"),
    ],
)
def test_verdict(rules, expected):
    crit, matches = case(*rules)
    assert verdict(CLINICAL, matches, crit) == expected


def test_triage_routes_short_circuit():
    crit, matches = case(("duration", "met"))
    fix = TriageResult(reason_class="administrative", route="fix_checklist", method="carc_table")
    excl = TriageResult(reason_class="plan_exclusion", route="not_winnable", method="carc_table")
    assert verdict(fix, matches, crit) == "fix_checklist"
    assert verdict(excl, matches, crit) == "not_winnable"


def test_adjust_rules():
    assert adjust("documentation", "not_met") == "missing_documentation"
    assert adjust("exclusion", "missing_documentation") == "not_applicable"
    assert adjust("duration", "not_met") == "not_met"
    assert adjust("indication", "not_met") == "not_met"


def _facts(red_flags=()):
    from nebius_nvidia.facts import ChartFacts, FactsDraft, RedFlagFact

    d = FactsDraft(red_flags=[RedFlagFact(note_id="n1", quote="q", flag=f) for f in red_flags])
    return ChartFacts(draft=d, evidence={}, symptom_days=60, conservative_days=40, unverified=[])


@pytest.mark.parametrize(
    "first,second,referee,expected_status,confidence,calls",
    [
        ("met", "met", None, "met", "agreed", 2),
        ("met", "not_met", "met", "met", "escalated", 3),
        ("not_met", "met", "not_met", "not_met", "escalated", 3),
    ],
)
def test_votes_and_referee(monkeypatch, first, second, referee, expected_status, confidence, calls):
    import sys
    from datetime import date

    m = sys.modules["nebius_nvidia.match"]
    seen = []
    answers = iter([first, second, referee])

    def fake(model, messages, schema, **kw):
        seen.append((model, kw["step"]))
        return schema(status=next(answers), evidence=[], rationale="r")

    monkeypatch.setattr(m, "structured", fake)
    crit = Criterion(criterion_id="C1", doc_id="d", summary="s", verbatim_span="x", kind="duration")
    res = m.match_one(crit, [], _facts(), date(2026, 8, 1))
    assert res.confidence == confidence and len(seen) == calls
    # A "met" with no verified chart evidence is downgraded to missing_documentation.
    assert res.status == ("missing_documentation" if expected_status == "met" else expected_status)
    if confidence == "escalated":
        assert seen[-1][0] == m.ULTRA and seen[-1][1].endswith(":referee")


def test_red_flag_route_decided_in_code(monkeypatch):
    import sys
    from datetime import date

    m = sys.modules["nebius_nvidia.match"]
    monkeypatch.setattr(m, "structured", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no model call")))
    crit = Criterion(criterion_id="C1", doc_id="d", summary="s", verbatim_span="x", kind="red_flag")
    res = m.match_one(crit, [], _facts(), date(2026, 8, 1))
    assert res.status == "not_applicable" and res.confidence == "rule"
