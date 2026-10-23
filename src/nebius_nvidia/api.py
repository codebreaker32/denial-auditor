"""HTTP API and static host for the Denial Auditor web app.

Run locally:  ./.venv/bin/uvicorn nebius_nvidia.api:app --port 8600
Serves web/ (the frontend) and these endpoints:

  GET  /api/cases                 worklist rows (precomputed runs + this server's live runs)
  GET  /api/cases/{id}            one case: run, notes, policy split into numbered sentences
  GET  /api/cases/{id}/letter     the synthetic scanned denial letter (PNG)
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
from nebius_nvidia.models import CaseRun, ChartNote
from nebius_nvidia.scenario import Scenario
from nebius_nvidia.rules import deadline as deadline_for
from nebius_nvidia.text import locate, normalize, segment

ROOT = Path(os.environ.get("DA_ROOT", Path(__file__).resolve().parents[2]))
CASES = ROOT / "cases"
RUNS = ROOT / "demo" / "runs"
WEB = ROOT / "web"
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


# Duration thresholds the timeline draws, each tied to the policy sentence that states it.
# "from" is the clock start: symptom onset, or the first conservative treatment.
THRESHOLDS = {
    "L34220": [
        {"label": "1 month of symptoms", "from": "onset", "days": 30, "anchor": "the MRI may be appropriate after 1 month of symptoms"},
        {"label": "4 weeks of conservative care", "from": "treatment", "days": 28, "anchor": "conservative management lasting at least four weeks"},
    ],
    "Aetna CPB 0236": [
        {"label": "6 weeks of conservative therapy", "from": "treatment", "days": 42, "anchor": "no improvement after 6 weeks of conservative therapy"},
    ],
}


def _thresholds(run: CaseRun, sentences: list[dict]) -> list[dict]:
    if not run.policy:
        return []
    out = []
    for t in THRESHOLDS.get(run.policy.policy_id, []):
        hit = locate(t["anchor"], run.policy.text)
        n = next((x["n"] for x in sentences if hit and x["start"] <= hit[0] < x["end"]), None)
        if n:
            out.append({**{k: v for k, v in t.items() if k != "anchor"}, "sentence": n,
                        "address": f"{run.policy.policy_id} · S{n}"})
    return out


@app.get("/api/cases/{case_id}")
def get_case(case_id: str) -> dict:
    case_id = _safe_id(case_id)
    run = _run(case_id)
    s = Scenario.load(CASES / case_id)
    notes = _notes(case_id)
    sentences = []
    if run.policy:
        # Numbered sentence units of the fetched policy, and which criteria cover each one.
        for i, (a, b) in enumerate(segment(run.policy.text), start=1):
            covering = [c.criterion_id for c in run.criteria if c.span_verified and c.span_start is not None
                        and c.span_start <= a and b <= c.span_end]
            sentences.append({"n": i, "start": a, "end": b, "text": run.policy.text[a:b], "criteria": covering})
    addr = {}
    for c in run.criteria:
        ns = [x["n"] for x in sentences if c.criterion_id in x["criteria"]]
        addr[c.criterion_id] = f"S{ns[0]}" + (f"–{ns[-1]}" if len(ns) > 1 else "") if ns else ""
    return {
        "id": case_id,
        "patient": s.patient_name,
        "run": run.model_dump(mode="json"),
        "notes": [n.model_dump(mode="json") for n in notes],
        "sentences": sentences,
        "addresses": addr,
        "as_of": (as_of := board_as_of()).isoformat(),
        "deadline": _deadline(run, as_of).model_dump(mode="json"),
        "policy_citation": run.policy.citation() if run.policy else None,
        "thresholds": _thresholds(run, sentences),
        "live": case_id in _live,
    }


@app.get("/api/cases/{case_id}/letter")
def letter(case_id: str):
    case_id = _safe_id(case_id)
    return FileResponse(CASES / case_id / "letter.png", media_type="image/png")


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
    _jobs[job] = {"case_id": case_id, "steps": [], "state": "running", "error": None}

    def work():
        from nebius_nvidia.pipeline import run_case

        try:
            run, _ = run_case(CASES / case_id, progress=lambda m: _jobs[job]["steps"].append(m))
            with _lock:
                _live[case_id] = run
            _jobs[job]["state"] = "done"
        except BudgetExceeded as e:
            _jobs[job].update(state="error", error=f"Stopped by this deployment's spending cap: {e}")
        except Exception as e:  # noqa: BLE001 - surfaced to the user as a failed run
            _jobs[job].update(state="error", error=f"{type(e).__name__}: {str(e)[:300]}")

    threading.Thread(target=work, daemon=True).start()
    return {"job": job}


@app.get("/api/live/{job}")
def live_status(job: str) -> dict:
    if job not in _jobs:
        raise HTTPException(404, "No such job")
    return _jobs[job]


@app.get("/healthz")
def health() -> dict:
    return {"ok": True}


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
