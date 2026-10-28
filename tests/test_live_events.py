"""The live-run activity feed: event order, plain wording, rule streaming and the API job record (offline)."""

import threading
import time
from datetime import date, datetime
from pathlib import Path

import pytest

from nebius_nvidia import appeal, match, pipeline
from nebius_nvidia.facts import ChartFacts, FactsDraft, OnsetFact, verify_quote
from nebius_nvidia.models import (
    AppealDraft, Criterion, CriterionMatch, Denial, GateResult, PolicyDoc, QuoteCheck, Section,
)

CASE = Path(__file__).resolve().parents[1] / "cases" / "case_031"
POLICY_TEXT = ("Lumbar MRI is indicated for red-flag conditions. "
               "MRI is covered after a trial of conservative management of at least four weeks. "
               "MRI that duplicates other imaging is not necessary.")


def _crit(i: int, kind: str, sentence: str) -> Criterion:
    a = POLICY_TEXT.index(sentence)
    return Criterion(criterion_id=f"C{i}", doc_id="L34220v40", summary=sentence, verbatim_span=sentence, kind=kind,
                     span_start=a, span_end=a + len(sentence), span_verified=True)


CRITERIA = [
    _crit(1, "red_flag", "Lumbar MRI is indicated for red-flag conditions."),
    _crit(2, "duration", "MRI is covered after a trial of conservative management of at least four weeks."),
    _crit(3, "exclusion", "MRI that duplicates other imaging is not necessary."),
]
POLICY = PolicyDoc(source="cms-lcd", policy_id="L34220", version="40", title="Lumbar MRI", effective_from=date(2025, 10, 23),
                   effective_to=None, version_basis="api-versioned", url="https://example.invalid/lcd",
                   fetched_at=datetime(2026, 10, 28, 12, 0), fetched_via="cms-api", text=POLICY_TEXT)
DENIAL = Denial(payer_name="Prosper Health MA (synthetic)", plan_type="MA", cpt="72148", icd10=["M54.50"],
                dos=date(2026, 8, 4), notice_date=date(2026, 8, 23), carc=["50"], reason_text="Not medically necessary.",
                practice_state="NV")


def _facts(notes) -> ChartFacts:
    n = notes[0]
    quote = n.text.split("\n")[0]
    onset = OnsetFact(note_id=n.note_id, quote=quote, date=date(2026, 5, 12))
    return ChartFacts(draft=FactsDraft(onset=onset), evidence={"onset": verify_quote(onset, notes)},
                      symptom_days=84, conservative_days=None, unverified=[])


# C2 finishes first, then C3, then C1; C3 is a split the referee settled.
STATUS = {"C1": ("not_applicable", 0.15, "rule"), "C2": ("met", 0.0, "agreed"), "C3": ("not_applicable", 0.07, "escalated")}


def fake_match_one(criterion, notes, facts, dos, model, tracker, cpt, votes):
    status, delay, conf = STATUS[criterion.criterion_id]
    time.sleep(delay)
    return CriterionMatch(criterion_id=criterion.criterion_id, status=status, rationale="r", confidence=conf)


@pytest.fixture
def fakes(monkeypatch):
    monkeypatch.setattr(pipeline, "read_denial", lambda *a, **k: DENIAL)
    monkeypatch.setattr(pipeline, "resolve_policy", lambda *a, **k: POLICY)
    monkeypatch.setattr(pipeline, "extract_criteria", lambda *a, **k: CRITERIA)
    monkeypatch.setattr(pipeline, "extract_facts", lambda notes, dos, tracker=None: _facts(notes))
    monkeypatch.setattr(match, "match_one", fake_match_one)

    def fake_draft(run, notes, patient, tracker=None, on_step=None):
        for line in ("Writing the first draft from 5 verified quotes", "Checking every quote: 4 of 4 match the fetched text"):
            on_step(line)
        return AppealDraft(sections=[Section(heading="h", body="b")]), [], GateResult(ok=True, checks=[])

    monkeypatch.setattr(pipeline, "draft_appeal", fake_draft)


def test_match_all_keeps_criteria_order_and_reports_in_completion_order(monkeypatch):
    monkeypatch.setattr(match, "match_one", fake_match_one)
    seen = []
    out = match.match_all(CRITERIA, [], None, date(2026, 8, 4), on_done=lambda c, m: seen.append((c.criterion_id, m.status)))
    assert [m.criterion_id for m in out] == ["C1", "C2", "C3"]
    assert [cid for cid, _ in seen] == ["C2", "C3", "C1"]
    assert dict(seen)["C2"] == "met"
    # Backward compatible: no callback, same result.
    assert [m.criterion_id for m in match.match_all(CRITERIA, [], None, date(2026, 8, 4))] == ["C1", "C2", "C3"]


def test_run_case_streams_plain_events(fakes):
    events, steps = [], []
    run, _ = pipeline.run_case(CASE, progress=steps.append, on_event=events.append)

    # The legacy progress strings are unchanged.
    assert steps[0].startswith("Reading the denial letter") and steps[-1].startswith("Done: appeal")
    assert [s.split(" ")[0] for s in steps[1:3]] == ["Triage", "Finding"]

    kinds = [(e["step"], e["kind"]) for e in events]
    assert [k for k in kinds if k[1] == "start"] == [(i, "start") for i in range(7)]
    assert events[-1]["kind"] == "done" and events[-1]["step"] == 7 and events[-1]["verdict"] == "appeal"
    assert all(e["at"] >= 0 for e in events)
    assert [e["at"] for e in events] == sorted(e["at"] for e in events)

    text = [e["text"] for e in events]
    assert "Read the denial: Prosper Health MA · CPT 72148 · service Aug 4, 2026 · reason code 50" in text
    assert "Medicare policy L34220 version 40, in effect on the service date (effective Oct 23, 2025)" in text
    assert "Found 3 rules in the policy" in text
    assert any(t.startswith("Chart: ") and "onset May 12, 2026" in t and "no dated therapy" in t for t in text)
    assert "Checking every quote: 4 of 4 match the fetched text" in text
    for t in text:  # biller language: no model names, no money
        assert "Nemotron" not in t and "Super" not in t and "Ultra" not in t and "$" not in t

    rules = [e for e in events if e["kind"] == "rule"]
    assert [e["id"] for e in rules] == ["C2", "C3", "C1"]  # as each completes
    assert all(e["step"] == 5 and e["total"] == 3 for e in rules)
    assert {e["id"]: (e["status"], e["ref"]) for e in rules} == {
        "C1": ("not_applicable", "§1"), "C2": ("met", "§2"), "C3": ("not_applicable", "§3")}
    i = next(n for n, e in enumerate(events) if e.get("id") == "C3" and e["kind"] == "rule")
    assert events[i + 1] == {**events[i + 1], "kind": "detail", "text": "Second look settled this one", "id": "C3"}
    # Returned matches stay in criteria order.
    assert [m.criterion_id for m in run.matches] == ["C1", "C2", "C3"]


def test_short_rule_trims_to_a_name():
    assert pipeline.short_rule("MRI covered only if patient has not responded to a reasonable trial of conservative management.") \
        == "MRI covered only if patient has not responded…"
    assert pipeline.short_rule("Duplicate imaging (e.g. CT) is unnecessary.") == "Duplicate imaging"


def test_draft_appeal_reports_each_substep(monkeypatch):
    calls = []

    def fake_structured(model, messages, schema, **kw):
        calls.append(kw["step"])
        if schema is appeal.CritiqueOut:
            return schema(items=[{"issue": "i", "severity": "major", "suggestion": "s"},
                                 {"issue": "j", "severity": "minor", "suggestion": "t"}])
        return schema(sections=[{"heading": h, "body": "Please reconsider."} for h in ("Request", "Facts", "Ask")])

    monkeypatch.setattr(appeal, "structured", fake_structured)
    monkeypatch.setattr(appeal, "build_quote_bank", lambda run, notes: [])
    monkeypatch.setattr(appeal, "session_for", lambda run, notes: None)
    monkeypatch.setattr(appeal, "_context", lambda run, patient: "context")
    monkeypatch.setattr(appeal, "check", lambda text, session: GateResult(
        ok=False, reason="r", checks=[QuoteCheck(text="a", status="verified"), QuoteCheck(text="b", status="not_found")]))
    lines = []
    appeal.draft_appeal(None, [], "Test Patient", on_step=lines.append)
    assert calls == ["appeal_draft", "appeal_critique", "appeal_revise"]
    assert lines == [
        "Writing the first draft from 0 verified quotes",
        "First draft written: 3 sections",
        "A payer-side reviewer is reading the draft",
        "Review raised 2 points, 1 major",
        "Revising the draft to answer the review",
        "Revision done",
        "Checking every quote: 1 of 2 match the fetched text. Export is blocked until they all match",
    ]


def test_api_job_collects_events(monkeypatch):
    from nebius_nvidia import api

    def fake_run_case(case_dir, progress=None, on_event=None):
        progress("Reading the denial letter (model)")
        on_event({"at": 0.0, "step": 0, "kind": "start", "text": "Reading the faxed denial letter"})
        raise RuntimeError("boom")

    monkeypatch.setattr(pipeline, "run_case", fake_run_case)
    api._jobs["t1"] = {"case_id": "case_031", "steps": [], "events": [], "state": "running", "error": None}
    t = threading.Thread(target=api._work, args=("t1", "case_031"))
    t.start()
    t.join()
    got = api.live_status("t1")
    assert got["steps"] == ["Reading the denial letter (model)"]
    assert got["events"][0]["text"] == "Reading the faxed denial letter"
    assert got["state"] == "error" and got["error"].startswith("RuntimeError: boom")
    got["events"].append("x")  # a snapshot, not the live list
    assert len(api._jobs["t1"]["events"]) == 1
    del api._jobs["t1"]


def test_live_total_limit_is_five_ever(tmp_path, monkeypatch):
    """After TOTAL_LIMIT successful starts the passcode stops working for good (user, 2026-10-28)."""
    import pytest
    from fastapi import HTTPException

    from nebius_nvidia import api

    monkeypatch.setattr(api, "STATE", tmp_path)
    monkeypatch.setattr(api, "TOTAL_LIMIT", 5)
    monkeypatch.setenv("DEMO_PASSCODE", "pc")
    monkeypatch.setattr(api.threading, "Thread", lambda *a, **k: type("T", (), {"start": lambda self: None})())
    body = api.LiveIn(case_id="case_015", passcode="pc")
    for _ in range(5):
        assert api.start_live(body)["job"]
    assert api._live_left() == 0
    with pytest.raises(HTTPException) as e:
        api.start_live(body)
    assert e.value.status_code == 429 and "5 live runs" in e.value.detail
