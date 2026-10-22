import streamlit as st

from nebius_nvidia.citations import check
from nebius_nvidia.models import ChartNote
from ui import CASES, STATUS, VERDICT, esc, footer, quote_html, load_runs, notes_of, pill, run_of, scenario_of, session_for, setup

setup("Case")
runs = load_runs()
if not runs:
    st.info("No case runs yet.")
    st.stop()

ids = list(runs)
case_id = st.session_state.get("case_id", ids[0])
case_id = st.selectbox("Case", ids, index=ids.index(case_id) if case_id in ids else 0,
                       format_func=lambda c: f"{c} · {scenario_of(c).patient_name} · {runs[c]['denial']['payer_name']}")
st.session_state["case_id"] = case_id

run = run_of(case_id)
notes = [ChartNote.model_validate(n) for n in notes_of(case_id)]
d = run.denial
label, kind, blurb = VERDICT[run.verdict]

st.markdown(f"## {pill(label, kind)} &nbsp; {esc(scenario_of(case_id).patient_name)} — lumbar MRI denied", unsafe_allow_html=True)
st.markdown(f'<div class="muted">{blurb}</div>', unsafe_allow_html=True)

tab_board, tab_letter, tab_out, tab_chart, tab_trace = st.tabs(
    ["Evidence board", "Denial letter", "Appeal / next step", "Chart notes", "Models & cost"])

with tab_board:
    left, right = st.columns([1, 2], gap="large")
    with left:
        dl = run.deadline
        st.markdown(f"""<div class="card"><h4>Denial</h4>
<div><b>Payer</b>: {esc(d.payer_name)} ({d.plan_type.replace('_', ' ')})</div>
<div><b>CPT</b>: {d.cpt} &nbsp; <b>ICD-10</b>: {', '.join(d.icd10)}</div>
<div><b>Date of service</b>: {d.dos:%m/%d/%Y} &nbsp; <b>Notice</b>: {d.notice_date:%m/%d/%Y}</div>
<div><b>Reason</b>: {esc(d.reason_text)} {('(codes ' + ', '.join(d.carc) + ')') if d.carc else ''}</div>
<div class="cite">Read from the scanned letter by {d.extracted_by.split('/')[-1] or 'model'}</div></div>""", unsafe_allow_html=True)
        triage_kind = {"clinical_review": "info", "fix_checklist": "warn", "not_winnable": "mute"}[run.triage.route]
        checklist = "".join(f"<li>{esc(i)}</li>" for i in run.triage.checklist)
        st.markdown(f"""<div class="card"><h4>Triage {pill(run.triage.reason_class.replace('_', ' '), triage_kind)}</h4>
<div class="muted">{esc(run.triage.explanation)}</div>{f'<ul>{checklist}</ul>' if checklist else ''}
<div class="cite">Decided by {'the reason-code table (no model)' if run.triage.method == 'carc_table' else 'Nemotron Nano'}</div></div>""", unsafe_allow_html=True)
        if dl:
            dl_kind = "bad" if (dl.days_left or 0) < 14 else "warn" if (dl.days_left or 0) < 30 else "ok"
            st.markdown(f"""<div class="card"><h4>Appeal deadline {pill(f"{dl.days_left} days left" if dl.days_left is not None else "check notice", dl_kind)}</h4>
<div>{dl.due:%m/%d/%Y}</div><div class="muted">{esc(dl.basis)}</div>
<div class="cite">{esc(dl.citation)} {'' if dl.verified else '· UNVERIFIED'} · fixed rules table, not a model</div></div>""" if dl.due else
                        f'<div class="card"><h4>Appeal deadline</h4><div class="muted">{esc(dl.basis)}</div></div>', unsafe_allow_html=True)
    with right:
        if run.policy:
            p = run.policy
            basis = ("Version selected by date of service from the CMS Coverage API" if p.version_basis == "api-versioned"
                     else "Snapshot of the payer's current bulletin (no prior versions published)")
            st.markdown(f"""<div class="card"><h4>Policy in effect on {d.dos:%m/%d/%Y}</h4>
<div><b>{esc(p.title)}</b></div><div>{esc(p.citation())}</div>
<div class="cite">{basis} · <a href="{p.url}" target="_blank">source</a></div></div>""", unsafe_allow_html=True)
        if not run.matches:
            st.info("No clinical review needed for this denial.")
        crit = {c.criterion_id: c for c in run.criteria}
        shown = [m for m in run.matches if m.status != "not_applicable"]
        hidden = [m for m in run.matches if m.status == "not_applicable"]
        for m in sorted(shown, key=lambda m: ["not_met", "missing_documentation", "met"].index(m.status)):
            c = crit[m.criterion_id]
            s_label, s_kind = STATUS[m.status]
            ev = "".join(
                f'<div class="quote chart">{quote_html(e.quote)}</div><div class="cite">Chart: {e.note_id}{"" if e.verified else " · UNVERIFIED"}</div>'
                for e in m.evidence)
            st.markdown(f"""<div class="card"><h4>{pill(s_label, s_kind)} &nbsp; {esc(c.summary)}</h4>
<div class="quote">{quote_html(c.verbatim_span)}</div><div class="cite">Policy text, verbatim · {esc(run.policy.citation() if run.policy else c.doc_id)}</div>
{ev}<div class="muted" style="margin-top:6px">→ {esc(m.rationale)}</div></div>""", unsafe_allow_html=True)
        if hidden:
            with st.expander(f"{len(hidden)} policy rules not applicable to this case"):
                for m in hidden:
                    st.markdown(f"- **{crit[m.criterion_id].summary}** — {m.rationale}")

with tab_letter:
    img = CASES / case_id / "letter.png"
    if img.exists():
        st.image(str(img), caption="Synthetic faxed denial notice (read by Nemotron 3.5 Super-VL)", width=620)

with tab_out:
    if run.appeal:
        st.markdown("#### Appeal letter")
        st.caption("Edit freely. Every quote is re-checked against the fetched policy and the chart on each change; "
                   "export unlocks only when all quotes are verified word for word.")
        key = f"letter_{case_id}"
        text = st.text_area("Letter", value=st.session_state.get(key, run.appeal.rendered), height=520, label_visibility="collapsed")
        st.session_state[key] = text
        gate = check(text, session_for(run, notes))
        st.markdown(f"#### Citation gate {pill('PASS · export enabled' if gate.ok else 'BLOCKED', 'ok' if gate.ok else 'bad')}",
                    unsafe_allow_html=True)
        for q in gate.checks:
            icon = "✅" if q.status == "verified" else "❌"
            st.markdown(f"{icon} `{q.text[:110]}{'…' if len(q.text) > 110 else ''}` {'· ' + q.source_id if q.source_id else '· not found in any fetched source'}")
        if not gate.ok and gate.reason:
            st.error(gate.reason)
        st.download_button("Export letter (.md)", text, file_name=f"{case_id}_appeal.md", disabled=not gate.ok, type="primary")
        st.caption("A person reviews and sends this letter. Denial Auditor never submits anything.")
        if run.appeal.critique:
            with st.expander(f"Payer-reviewer critique addressed in revision {run.appeal.revision}"):
                for c in run.appeal.critique:
                    st.markdown(f"- **{c.severity}**: {c.issue} → _{c.suggestion}_")
    elif run.doc_request:
        st.markdown("#### Documentation request to the physician")
        st.code(run.doc_request, language=None)
    else:
        st.markdown(f"#### {label}")
        st.write(blurb)
        for m in run.matches:
            if m.status == "not_met":
                st.markdown(f"- **{crit[m.criterion_id].summary}** — {m.rationale}")
        for item in run.triage.checklist:
            st.markdown(f"- {item}")

with tab_chart:
    for n in notes:
        with st.expander(f"{n.date:%m/%d/%Y} · {n.note_type.replace('_', ' ')} · {n.author_role}"):
            st.text(n.text)

with tab_trace:
    st.markdown(f"**Total model cost for this case: ${run.cost_usd:.4f}** (Nemotron models on Nebius Token Factory)")
    st.dataframe([{"Step": t.step, "Model": t.model.split("/")[-1], "Prompt tokens": t.prompt_tokens,
                   "Completion tokens": t.completion_tokens, "Cost": round(t.cost_usd, 5), "Seconds": t.latency_s,
                   "Attempts": t.attempts} for t in run.trace], hide_index=True, width="stretch")

footer()
