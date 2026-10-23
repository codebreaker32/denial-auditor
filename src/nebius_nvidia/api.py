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
from nebius_nvidia.text import normalize, segment

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


def _row(case_id: str, run: CaseRun, live: bool) -> dict:
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
        "days_left": run.deadline.days_left if run.deadline else None,
        "due": run.deadline.due.isoformat() if run.deadline and run.deadline.due else None,
        "policy": run.policy.citation() if run.policy else None,
        "cost_usd": run.cost_usd,
        "live": live,
    }


@app.get("/api/cases")
def list_cases() -> dict:
    rows = {p.stem: _row(p.stem, CaseRun.model_validate_json(p.read_text()), False) for p in sorted(RUNS.glob("case_*.json"))}
    for cid, run in _live.items():
        rows[cid] = _row(cid, run, True)
    available = sorted(p.name for p in CASES.iterdir() if (p / "notes.json").exists())
    return {"cases": list(rows.values()), "available": available, "live_enabled": bool(os.environ.get("DEMO_PASSCODE"))}


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
        "policy_citation": run.policy.citation() if run.policy else None,
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
    out = []
    for c in result.checks:
        item = c.model_dump()
        if c.status != "verified" and units:
            q = normalize(c.text)
            best = max(units, key=lambda u: difflib.SequenceMatcher(None, q, normalize(u[1])).ratio())
            item["closest"] = {"source_id": best[0], "text": best[1]}
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
