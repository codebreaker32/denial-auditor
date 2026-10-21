import json

import pytest

from nebius_nvidia.citations import Session, check, extract_quotes
from nebius_nvidia.cms import lcd_from_row
from nebius_nvidia.criteria import CriterionPick, build_criteria, numbered


@pytest.fixture
def doc(cms_fixture):
    return lcd_from_row(cms_fixture["L34220_v40"][0])


@pytest.fixture
def session(doc):
    s = Session()
    s.add("L34220v40", doc.text)
    s.add("note-pt", "SYNTHETIC – NOT A REAL PATIENT\nPhysical therapy 3x weekly from 07/01/2026 to 08/05/2026 with no improvement.")
    return s


GOOD = (
    "Dear Medical Director,\n\n"
    "The policy in effect on the date of service states:\n\n"
    "> MRI will be covered only if the patient has not responded to a reasonable trial of\n"
    "> conservative management lasting at least four weeks.\n"
    "> — L34220 v40, eff 10/23/2025, CMS Coverage API\n\n"
    'The chart documents "Physical therapy 3x weekly from 07/01/2026 to 08/05/2026 with no improvement."\n'
)


def test_good_letter_passes(session):
    r = check(GOOD, session)
    assert r.ok, r
    assert {c.source_id for c in r.checks} == {"L34220v40", "note-pt"}


def test_curly_quotes_and_line_breaks_pass(session):
    letter = GOOD.replace('"Physical', "“Physical").replace('improvement."', "improvement.”")
    assert check(letter, session).ok


@pytest.mark.parametrize(
    "old,new",
    [
        ("four weeks", "two weeks"),  # changed word
        ("at least four", "at least 4"),  # digit for word
        ("conservative management", "Conservative management"),  # case
        ("3x weekly", "2x weekly"),  # chart number
    ],
)
def test_tampered_quote_blocked(session, old, new):
    r = check(GOOD.replace(old, new), session)
    assert not r.ok
    assert any(c.status == "not_found" for c in r.checks)


def test_ellipsis_blocked(session):
    letter = "> MRI will be covered only if ... at least four weeks.\n"
    assert not check(letter, session).ok


def test_quote_from_unfetched_source_blocked(doc):
    empty = Session()  # nothing fetched this session
    assert not check(GOOD, empty).ok


def test_no_quotes_fails(session):
    r = check("Please reconsider this denial.", session)
    assert not r.ok and "quotes no policy text" in r.reason


def test_citation_line_not_part_of_quote():
    assert extract_quotes("> a b c\n> — L1 v1\n") == ["a b c"]


def test_short_inline_quotes_ignored():
    assert extract_quotes('This is "not checked" but "this one is checked".') == ["this one is checked"]


def test_criteria_spans_always_pass_gate(doc, session):
    """Spans built from sentence picks are cut from the source, so the gate verifies them."""
    _, units = numbered(doc)
    picks = [CriterionPick(summary="s", kind="duration", sentence_ids=[i]) for i in range(1, len(units) + 1)]
    for c in build_criteria(picks, doc, units):
        assert check(f"> {c.verbatim_span}\n", session).ok, c.verbatim_span[:80]


def _run_with_bank(doc):
    from datetime import date

    from nebius_nvidia.models import CaseRun, Criterion, CriterionMatch, Denial, Evidence, TriageResult

    crit = Criterion(criterion_id="C1", doc_id="L34220v40", summary="s", kind="duration",
                     verbatim_span="conservative management lasting at least four weeks", span_start=0, span_end=1, span_verified=True)
    m = CriterionMatch(criterion_id="C1", status="met", rationale="r",
                       evidence=[Evidence(note_id="note-pt", quote="Physical therapy 3x weekly from 07/01/2026 to 08/05/2026 with no improvement.", verified=True)])
    denial = Denial(payer_name="p", plan_type="MA", cpt="72148", icd10=["M54.50"], dos=date(2026, 8, 14),
                    notice_date=date(2026, 8, 28), reason_text="x")
    tri = TriageResult(reason_class="clinical", route="clinical_review", method="carc_table")
    return CaseRun(case_id="c", denial=denial, triage=tri, policy=doc, criteria=[crit], matches=[m], verdict="appeal")


def test_rendered_markers_pass_gate_and_typed_quotes_fail(doc, session):
    from nebius_nvidia.appeal import build_quote_bank, render
    from nebius_nvidia.models import AppealDraft, Section

    bank = build_quote_bank(_run_with_bank(doc), [])
    assert [q.qid for q in bank] == ["P1", "E1"]
    good = AppealDraft(sections=[Section(heading="Policy", body="The policy says:\n{{Q:P1}}\nThe chart shows:\n{{Q:E1}}")])
    assert check(render(good, bank), session).ok
    typed = AppealDraft(sections=[Section(heading="Policy", body='{{Q:P1}}\nThe policy only requires "two weeks of conservative care".')])
    assert not check(render(typed, bank), session).ok
    unknown = AppealDraft(sections=[Section(heading="Policy", body="{{Q:P1}}\n{{Q:P9}}")])
    assert not check(render(unknown, bank), session).ok
