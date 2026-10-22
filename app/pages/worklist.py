import streamlit as st

from ui import VERDICT, footer, load_runs, scenario_of, setup

setup("Worklist")
st.title("Denial worklist")
st.markdown('<div class="muted">Imaging denials, sorted so the winnable ones come first. '
            "Every verdict is backed by the payer's own policy text, quoted word for word.</div>", unsafe_allow_html=True)

runs = load_runs()
if not runs:
    st.info("No case runs yet. Build them with `python scripts/precompute.py`.")
    st.stop()

order = {"appeal": 0, "doc_request": 1, "fix_checklist": 2, "dont_appeal": 3, "not_winnable": 4}
rows = []
for cid, r in runs.items():
    s = scenario_of(cid)
    d = r["denial"]
    dl = r.get("deadline") or {}
    rows.append({
        "case": cid,
        "Patient (synthetic)": s.patient_name,
        "Payer": d["payer_name"],
        "CPT": d["cpt"],
        "Date of service": d["dos"],
        "Denial reason": d["reason_text"],
        "Recommendation": VERDICT[r["verdict"]][0],
        "Days to deadline": dl.get("days_left"),
        "Cost": r.get("cost_usd", 0.0),
        "_order": order[r["verdict"]],
    })
rows.sort(key=lambda x: (x["_order"], x["Days to deadline"] if x["Days to deadline"] is not None else 999))

c1, c2, c3, c4 = st.columns(4)
for col, (label, n) in zip(
    (c1, c2, c3, c4),
    [("Denials", len(rows)),
     ("Appeal now", sum(r["Recommendation"] == "Appeal" for r in rows)),
     ("Ask the physician", sum(r["Recommendation"] == "Ask the physician" for r in rows)),
     ("Fix or drop", sum(r["Recommendation"] in ("Fix & resubmit", "Not winnable", "Don't appeal yet") for r in rows))],
):
    col.markdown(f'<div class="card"><div class="muted">{label}</div><div class="kpi">{n}</div></div>', unsafe_allow_html=True)

event = st.dataframe(
    [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows],
    hide_index=True,
    width="stretch",
    on_select="rerun",
    selection_mode="single-row",
    column_config={
        "case": None,
        "Denial reason": st.column_config.TextColumn(width="large"),
        "Days to deadline": st.column_config.NumberColumn(format="%d days"),
        "Cost": st.column_config.NumberColumn("Model cost", format="$%.4f"),
    },
)
if event.selection.rows:
    st.session_state["case_id"] = rows[event.selection.rows[0]]["case"]
    st.switch_page("pages/case.py")
st.caption("Select a row to open the case. Deadlines are counted as of each case's review date.")
footer()
