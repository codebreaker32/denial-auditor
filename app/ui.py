"""Shared UI helpers: styling, data loading, small components."""

import json
from pathlib import Path

import streamlit as st

from nebius_nvidia.citations import Session
from nebius_nvidia.models import CaseRun, ChartNote
from nebius_nvidia.scenario import Scenario

ROOT = Path(__file__).resolve().parent.parent
CASES = ROOT / "cases"
RUNS = ROOT / "demo" / "runs"

AMA_LINE = "CPT® codes are shown as bare codes only. CPT is a registered trademark of the American Medical Association. All rights reserved."
DISCLAIMER = "Synthetic data only. Decision support for billing staff; not legal or medical advice. A person reviews and sends every appeal."

VERDICT = {
    "appeal": ("Appeal", "ok", "The chart meets the policy in effect on the date of service."),
    "doc_request": ("Ask the physician", "warn", "Winnable once the missing documentation is added."),
    "dont_appeal": ("Don't appeal yet", "bad", "The chart doesn't meet the policy yet."),
    "fix_checklist": ("Fix & resubmit", "info", "Administrative denial: fix the claim, no clinical appeal needed."),
    "not_winnable": ("Not winnable", "mute", "The plan excludes this service."),
}
STATUS = {
    "met": ("Met", "ok"),
    "not_met": ("Not met", "bad"),
    "missing_documentation": ("Missing documentation", "warn"),
    "not_applicable": ("Not applicable", "mute"),
}

CSS = """
<style>
.block-container {padding-top: 2.2rem; max-width: 1250px;}
.pill {display:inline-block; padding:2px 10px; border-radius:999px; font-size:0.78rem; font-weight:600; letter-spacing:.01em;}
.pill.ok {background:#DDF2E7; color:#14532D;}
.pill.bad {background:#FBE1DF; color:#7F1D1D;}
.pill.warn {background:#FCEFD3; color:#7C4A03;}
.pill.info {background:#DDEBF7; color:#1E3A5F;}
.pill.mute {background:#E9ECE8; color:#4B5550;}
.card {background:#FFFFFF; border:1px solid #E1E5DF; border-radius:12px; padding:14px 16px; margin-bottom:12px;}
.card h4 {margin:0 0 6px 0; font-size:1rem;}
.quote {border-left:3px solid #0F6E6E; background:#F3F7F6; padding:8px 12px; margin:6px 0; font-size:0.9rem; white-space:pre-wrap;}
.quote.chart {border-left-color:#7A6FB0; background:#F6F5FB;}
.cite {color:#5B6660; font-size:0.78rem; margin-top:2px;}
.muted {color:#5B6660; font-size:0.85rem;}
.kpi {font-size:1.6rem; font-weight:700; line-height:1.1;}
.banner {background:#FFF8E6; border:1px solid #F1D89A; border-radius:10px; padding:6px 12px; font-size:0.8rem; color:#6B4E0A;}
footer {visibility:hidden;}
</style>
"""


def setup(title: str) -> None:
    st.markdown(CSS, unsafe_allow_html=True)
    st.markdown(f'<div class="banner">🧪 {DISCLAIMER}</div>', unsafe_allow_html=True)


def pill(label: str, kind: str) -> str:
    return f'<span class="pill {kind}">{label}</span>'


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


@st.cache_data
def load_runs() -> dict[str, dict]:
    return {p.stem: json.loads(p.read_text()) for p in sorted(RUNS.glob("case_*.json"))}


def run_of(case_id: str) -> CaseRun:
    return CaseRun.model_validate(load_runs()[case_id])


@st.cache_data
def notes_of(case_id: str) -> list[dict]:
    return json.loads((CASES / case_id / "notes.json").read_text())


def scenario_of(case_id: str) -> Scenario:
    return Scenario.load(CASES / case_id)


def session_for(run: CaseRun, notes: list[ChartNote]) -> Session:
    s = Session()
    if run.policy:
        s.add(f"{run.policy.policy_id}v{run.policy.version}", run.policy.text)
    for n in notes:
        s.add(n.note_id, n.text)
    return s


def footer() -> None:
    st.markdown("---")
    st.markdown(f'<div class="muted">{AMA_LINE}<br>{DISCLAIMER}</div>', unsafe_allow_html=True)
