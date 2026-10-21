from datetime import date

import pytest

from nebius_nvidia import triage as triage_mod
from nebius_nvidia.models import Denial
from nebius_nvidia.triage import triage


def denial(carc, reason="x"):
    return Denial(payer_name="p", plan_type="MA", cpt="72148", icd10=["M54.50"], dos=date(2026, 8, 1),
                  notice_date=date(2026, 8, 15), carc=carc, reason_text=reason)


@pytest.fixture
def no_llm(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("LLM called although a CARC code was present")
    monkeypatch.setattr(triage_mod, "structured", boom)


@pytest.mark.parametrize(
    "carc,route",
    [(["50"], "clinical_review"), (["16"], "fix_checklist"), (["29"], "fix_checklist"),
     (["96"], "not_winnable"), (["204"], "not_winnable"), (["50", "16"], "fix_checklist"), (["50", "96"], "not_winnable")],
)
def test_carc_routes_without_llm(no_llm, carc, route):
    r = triage(denial(carc))
    assert r.route == route and r.method == "carc_table"


def test_fix_checklist_present(no_llm):
    assert triage(denial(["16"])).checklist


def test_llm_fallback_when_no_code(monkeypatch):
    calls = []

    def fake(model, messages, schema, **kw):
        calls.append(model)
        return schema(reason_class="clinical", explanation="medical necessity")

    monkeypatch.setattr(triage_mod, "structured", fake)
    r = triage(denial([], "Not medically necessary."))
    assert r.route == "clinical_review" and r.method == "llm" and calls
