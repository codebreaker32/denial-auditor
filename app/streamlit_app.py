"""Denial Auditor: Streamlit app.

Run locally:  ./.venv/bin/streamlit run app/streamlit_app.py
Shows precomputed case runs from demo/runs/ (built with scripts/precompute.py).
"""

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))

st.set_page_config(page_title="Denial Auditor", page_icon="⚖️", layout="wide")

pages = [
    st.Page("pages/worklist.py", title="Worklist", icon=":material/inbox:", default=True),
    st.Page("pages/case.py", title="Case", icon=":material/fact_check:"),
    st.Page("pages/live.py", title="Run live", icon=":material/play_circle:"),
    st.Page("pages/about.py", title="How it works", icon=":material/info:"),
]
st.navigation(pages).run()
