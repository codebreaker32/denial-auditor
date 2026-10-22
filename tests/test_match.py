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
