"""Run a case live (passcode-gated, rate-limited): every model call is real and costs credits."""

import os
from datetime import date

import streamlit as st

from nebius_nvidia.budget import BudgetExceeded, _locked_json
from nebius_nvidia.pipeline import run_case
from ui import CASES, VERDICT, footer, scenario_of, setup

SESSION_LIMIT = 3
DAILY_LIMIT = 30
COUNTER = os.environ.get("LIVE_COUNTER", "/state/live_runs.json" if os.path.isdir("/state") else ".cache/live_runs.json")

setup("Run live")
st.title("Run a case live")
st.markdown('<div class="muted">Runs the full pipeline on a synthetic case with real Nemotron calls on Nebius Token Factory '
            "(and Tavily search for commercial payers). Judges: the passcode is in the Devpost testing instructions.</div>",
            unsafe_allow_html=True)

expected = os.environ.get("DEMO_PASSCODE", "")
if not expected:
    st.info("Live mode is switched off on this deployment. Browse the precomputed cases in the Worklist.")
    footer()
    st.stop()

if not st.session_state.get("live_ok"):
    code = st.text_input("Passcode", type="password")
    if code and code == expected:
        st.session_state["live_ok"] = True
        st.rerun()
    elif code:
        st.error("That passcode isn't right.")
    footer()
    st.stop()

ids = sorted(p.name for p in CASES.iterdir() if (p / "notes.json").exists())
case_id = st.selectbox("Synthetic case", ids, format_func=lambda c: f"{c} · {scenario_of(c).patient_name} · {scenario_of(c).payer}")
used = st.session_state.get("live_count", 0)
st.caption(f"{SESSION_LIMIT - used} live runs left in this session · about 1–3 minutes and a few cents per run.")

if st.button("Run live", type="primary", disabled=used >= SESSION_LIMIT):
    today = date.today().isoformat()
    os.makedirs(os.path.dirname(COUNTER) or ".", exist_ok=True)
    with _locked_json(COUNTER, {}) as counts:
        if counts.get(today, 0) >= DAILY_LIMIT:
            st.error("The daily live-run limit for this demo has been reached. Please browse the precomputed cases.")
            st.stop()
        counts[today] = counts.get(today, 0) + 1
    st.session_state["live_count"] = used + 1
    with st.status("Running the pipeline…", expanded=True) as status:
        try:
            run, _ = run_case(CASES / case_id, progress=lambda msg: st.write(msg))
        except BudgetExceeded as e:
            status.update(label="Stopped by the budget cap", state="error")
            st.error(f"This deployment's spending cap was reached: {e}")
            st.stop()
        status.update(label=f"Done: {VERDICT[run.verdict][0]} · ${run.cost_usd:.4f}", state="complete")
    st.session_state.setdefault("live_runs", {})[case_id] = run.model_dump(mode="json")
    st.session_state["case_id"] = case_id
    st.success("Live result saved for this session.")
    st.page_link("pages/case.py", label="Open the evidence board", icon=":material/fact_check:")

footer()
