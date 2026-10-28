"""HTTP API and static host for the Denial Auditor web app.

Run locally:  ./.venv/bin/uvicorn nebius_nvidia.api:app --port 8600
Serves the frontend (ui/dist, the shadcn app, at /; the classic web/ app at /classic/) and these endpoints:

  GET  /api/cases                 worklist rows (precomputed runs + this server's live runs)
  GET  /api/cases/{id}            one case: run, notes, policy split into numbered sentences
  GET  /api/cases/{id}/letter     the synthetic scanned denial letter (PNG)
  GET  /api/checks                prior-auth checks (prevention mode, precomputed)
  GET  /api/checks/{id}           one check: result, notes, numbered policy sentences
  GET  /api/drift                 the policy watch's latest report (nebius_nvidia.drift, nightly)
  POST /api/gate                  re-check an edited appeal letter against the case's sources
  POST /api/live                  start a live run (passcode; rate-limited) → job id
  GET  /api/live/{job}            live run progress and result
"""

import difflib
import os
import threading
import uuid
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from nebius_nvidia.appeal import session_for
from nebius_nvidia.budget import BudgetExceeded, _locked_json
from nebius_nvidia.citations import check, extract_quotes
from nebius_nvidia.models import CaseRun, ChartNote, Criterion, PolicyDoc, PriorAuthCheck
from nebius_nvidia.prevention import THRESHOLDS
from nebius_nvidia.scenario import Scenario
from nebius_nvidia.rules import deadline as deadline_for
from nebius_nvidia.text import locate, normalize, segment

ROOT = Path(os.environ.get("DA_ROOT", Path(__file__).resolve().parents[2]))
CASES = ROOT / "cases"
RUNS = ROOT / "demo" / "runs"
CHECKS = ROOT / "demo" / "checks"
WEB = ROOT / "web"
UI_DIST = ROOT / "ui" / "dist"  # `cd ui && npm run build`
STATE = Path("/state") if Path("/state").is_dir() else ROOT / ".cache"
SESSION_LIMIT_PER_JOBS = 3  # per browser token
DAILY_LIMIT = 30

app = FastAPI(title="Denial Auditor", docs_url=None, redoc_url=None)
_live: dict[str, CaseRun] = {}  # live results held in memory for this server's lifetime
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _safe_id(case_id: str) -> str:
    if not case_id.startswith("case_") or not case_id[5:].isdigit() or not (CASES / case_id).is_dir():
        raise HTTPException(404, "No such case")
    return case_id


def _run(case_id: str) -> CaseRun:
    if case_id in _live:
        return _live[case_id]
    p = RUNS / f"{case_id}.json"
    if not p.exists():
        raise HTTPException(404, "This case hasn't been run yet")
    return CaseRun.model_validate_json(p.read_text())


def _notes(case_id: str) -> list[ChartNote]:
    import json

    return [ChartNote.model_validate(n) for n in json.loads((CASES / case_id / "notes.json").read_text())]


def _all_runs() -> dict[str, CaseRun]:
    runs = {p.stem: CaseRun.model_validate_json(p.read_text()) for p in sorted(RUNS.glob("case_*.json"))}
    runs.update(_live)
    return runs


def board_as_of(runs: dict[str, CaseRun] | None = None) -> date:
    """One review date for the whole board, so every deadline is counted the same way.

    The synthetic notices are dated in 2026, so the board is reviewed as of a week after
    the latest notice (stated in the UI), never against each case's own date.
    """
    from datetime import timedelta

    runs = runs if runs is not None else _all_runs()
    notices = [r.denial.notice_date for r in runs.values()]
    return (max(notices) if notices else date.today()) + timedelta(days=7)


def _deadline(run: CaseRun, as_of: date):
    return deadline_for(run.denial.plan_type, run.denial.notice_date, today=as_of)


def _row(case_id: str, run: CaseRun, live: bool, as_of: date) -> dict:
    s = Scenario.load(CASES / case_id)
    d = run.denial
    return {
        "id": case_id,
        "patient": s.patient_name,
        "payer": d.payer_name,
        "plan_type": d.plan_type,
        "cpt": d.cpt,
        "dos": d.dos.isoformat(),
        "reason": d.reason_text,
        "billed_usd": s.billed_usd,
        "verdict": run.verdict,
        "days_left": (dl := _deadline(run, as_of)).days_left,
        "due": dl.due.isoformat() if dl.due else None,
        "policy": run.policy.citation() if run.policy else None,
        "cost_usd": run.cost_usd,
        "live": live,
    }


@app.get("/api/cases")
def list_cases() -> dict:
    runs = _all_runs()
    as_of = board_as_of(runs)
    rows = [_row(cid, run, cid in _live, as_of) for cid, run in runs.items()]
    available = sorted(p.name for p in CASES.iterdir() if (p / "notes.json").exists())
    return {"cases": rows, "as_of": as_of.isoformat(), "available": available,
            "live_enabled": bool(os.environ.get("DEMO_PASSCODE"))}


def _thresholds(policy: PolicyDoc | None, sentences: list[dict]) -> list[dict]:
    """The policy's waiting periods for the timeline, each with the sentence that states it."""
    if not policy:
        return []
    out = []
    for t in THRESHOLDS.get(policy.policy_id, []):
        hit = locate(t["anchor"], policy.text)
        n = next((x["n"] for x in sentences if hit and x["start"] <= hit[0] < x["end"]), None)
        if n:
            out.append({**{k: v for k, v in t.items() if k != "anchor"}, "sentence": n,
                        "address": f"{policy.policy_id} · S{n}"})
    return out


def _policy_view(policy: PolicyDoc | None, criteria: list[Criterion]) -> dict:
    """Numbered sentence units of the fetched policy, which criteria cover each, and each criterion's address."""
    sentences = []
    if policy:
        for i, (a, b) in enumerate(segment(policy.text), start=1):
            covering = [c.criterion_id for c in criteria if c.span_verified and c.span_start is not None
                        and c.span_start <= a and b <= c.span_end]
            sentences.append({"n": i, "start": a, "end": b, "text": policy.text[a:b], "criteria": covering})
    addr = {}
    for c in criteria:
        ns = [x["n"] for x in sentences if c.criterion_id in x["criteria"]]
        addr[c.criterion_id] = f"S{ns[0]}" + (f"–{ns[-1]}" if len(ns) > 1 else "") if ns else ""
    return {"sentences": sentences, "addresses": addr, "thresholds": _thresholds(policy, sentences),
            "policy_citation": policy.citation() if policy else None}


@app.get("/api/cases/{case_id}")
def get_case(case_id: str) -> dict:
    case_id = _safe_id(case_id)
    run = _run(case_id)
    s = Scenario.load(CASES / case_id)
    notes = _notes(case_id)
    return {
        "id": case_id,
        "patient": s.patient_name,
        "billed_usd": s.billed_usd,
        "run": run.model_dump(mode="json"),
        "notes": [n.model_dump(mode="json") for n in notes],
        **_policy_view(run.policy, run.criteria),
        "as_of": (as_of := board_as_of()).isoformat(),
        "deadline": _deadline(run, as_of).model_dump(mode="json"),
        "live": case_id in _live,
    }


@app.get("/api/cases/{case_id}/letter")
def letter(case_id: str):
    case_id = _safe_id(case_id)
    return FileResponse(CASES / case_id / "letter.png", media_type="image/png")


def _check(case_id: str) -> PriorAuthCheck:
    p = CHECKS / f"{case_id}.json"
    if not p.exists():
        raise HTTPException(404, "No prior-auth check for this case")
    return PriorAuthCheck.model_validate_json(p.read_text())


@app.get("/api/checks")
def list_checks() -> dict:
    rows = []
    for p in sorted(CHECKS.glob("case_*.json")):
        ch = PriorAuthCheck.model_validate_json(p.read_text())
        r = ch.request
        rows.append({"id": ch.case_id, "patient": Scenario.load(CASES / ch.case_id).patient_name,
                     "payer": r.payer_name, "plan_type": r.plan_type, "cpt": r.cpt,
                     "planned_dos": r.planned_dos.isoformat(), "readiness": ch.readiness,
                     "earliest": ch.earliest.isoformat() if ch.earliest else None,
                     "policy": ch.policy.citation() if ch.policy else None, "cost_usd": ch.cost_usd})
    return {"checks": rows}


@app.get("/api/checks/{case_id}")
def get_check(case_id: str) -> dict:
    case_id = _safe_id(case_id)
    ch = _check(case_id)
    return {
        "id": case_id,
        "patient": Scenario.load(CASES / case_id).patient_name,
        "check": ch.model_dump(mode="json"),
        "notes": [n.model_dump(mode="json") for n in _notes(case_id)],
        **_policy_view(ch.policy, ch.criteria),
    }


@app.get("/api/drift")
def drift() -> dict:
    from nebius_nvidia.drift import REPORT

    if not REPORT.exists():
        return {"checked_at": None, "items": []}
    import json

    return json.loads(REPORT.read_text())


class GateIn(BaseModel):
    case_id: str
    text: str


@app.post("/api/gate")
def gate(body: GateIn) -> dict:
    case_id = _safe_id(body.case_id)
    run = _run(case_id)
    session = session_for(run, _notes(case_id))
    result = check(body.text, session)
    # For each failed quote, show the closest source sentence (display only; never used to pass).
    units = []
    for sid, text in session.sources.items():
        units += [(sid, text[a:b]) for a, b in segment(text)]
    notes = {n.note_id: n for n in _notes(case_id)}
    policy_id = f"{run.policy.policy_id}v{run.policy.version}" if run.policy else None
    pol_units = segment(run.policy.text) if run.policy else []

    def address(sid: str | None, quote: str) -> str | None:
        if not sid:
            return None
        if sid == policy_id:
            hit = locate(quote, run.policy.text)
            ns = [i for i, (a, b) in enumerate(pol_units, 1) if hit and a < hit[1] and b > hit[0]]
            return f"{run.policy.policy_id} · S{ns[0]}" + (f"–{ns[-1]}" if len(ns) > 1 else "") if ns else run.policy.policy_id
        if sid in notes:
            return f"note {sid.split('-')[-1]} · {notes[sid].date:%m/%d/%Y}"
        return sid

    out = []
    for c in result.checks:
        item = c.model_dump()
        item["address"] = address(c.source_id, c.text)
        if c.status != "verified" and units:
            q = normalize(c.text)
            best = max(units, key=lambda u: difflib.SequenceMatcher(None, q, normalize(u[1])).ratio())
            item["closest"] = {"source_id": best[0], "text": best[1], "address": address(best[0], best[1])}
        out.append(item)
    return {"ok": result.ok, "reason": result.reason, "checks": out, "quotes": len(extract_quotes(body.text))}


class LiveIn(BaseModel):
    case_id: str
    passcode: str


@app.post("/api/live")
def start_live(body: LiveIn) -> dict:
    expected = os.environ.get("DEMO_PASSCODE", "")
    if not expected:
        raise HTTPException(403, "Live mode is switched off on this deployment.")
    if body.passcode != expected:
        raise HTTPException(401, "That passcode isn't right.")
    case_id = _safe_id(body.case_id)
    STATE.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    with _locked_json(str(STATE / "live_runs.json"), {}) as counts:
        if counts.get(today, 0) >= DAILY_LIMIT:
            raise HTTPException(429, "Today's live-run limit for this demo has been reached. Browse the precomputed cases instead.")
        counts[today] = counts.get(today, 0) + 1
    job = uuid.uuid4().hex[:12]
    with _lock:
        _jobs[job] = {"case_id": case_id, "steps": [], "events": [], "state": "running", "error": None}
    threading.Thread(target=_work, args=(job, case_id), daemon=True).start()
    return {"job": job}


def _work(job: str, case_id: str) -> None:
    """Run one live case in a background thread; progress lines and feed events go on the job under _lock."""
    from nebius_nvidia.pipeline import run_case

    entry = _jobs[job]

    def add(key: str, item) -> None:
        with _lock:
            entry[key].append(item)

    def finish(**fields) -> None:
        with _lock:
            entry.update(**fields)

    try:
        run, _ = run_case(CASES / case_id, progress=lambda m: add("steps", m), on_event=lambda e: add("events", e))
        with _lock:
            _live[case_id] = run
        finish(state="done")
    except BudgetExceeded as e:
        finish(state="error", error=f"Stopped by this deployment's spending cap: {e}")
    except Exception as e:  # noqa: BLE001 - surfaced to the user as a failed run
        finish(state="error", error=f"{type(e).__name__}: {str(e)[:300]}")


@app.get("/api/live/{job}")
def live_status(job: str) -> dict:
    with _lock:
        if job not in _jobs:
            raise HTTPException(404, "No such job")
        j = _jobs[job]
        return {**j, "steps": list(j["steps"]), "events": list(j["events"])}


@app.get("/healthz")
def health() -> dict:
    return {"ok": True}


if UI_DIST.is_dir():
    app.mount("/classic", StaticFiles(directory=WEB, html=True), name="classic")
    app.mount("/", StaticFiles(directory=UI_DIST, html=True), name="ui")
else:
    app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
