import streamlit as st

from ui import footer, setup

setup("How it works")
st.title("How Denial Auditor works")
st.markdown("""
**Payers check your MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same.**

1. **Read the denial.** Nemotron 3.5 Super-VL reads the scanned notice; codes and dates are extracted as structured data.
2. **Triage.** Reason codes route administrative denials to a fix checklist and plan exclusions to "not winnable", with no model involved.
3. **Find the right policy version.** Medicare coverage policies come from the CMS Coverage API, choosing the version in effect on the
   date of service. Commercial bulletins (Aetna) are located at runtime with Tavily search.
4. **Split the policy into rules.** Code numbers the policy's sentences; Nemotron 3 Super only picks sentence numbers, so every rule
   is the payer's own wording, cut from the source.
5. **Match each rule to the chart.** Nemotron checks each rule against the notes and quotes its evidence; code verifies every quote
   and computes durations from dates. The final recommendation is a fixed rule, not a model's opinion.
6. **Write the appeal.** Nemotron 3 Ultra drafts using only pre-verified quotes; Super critiques it as the payer's medical reviewer;
   Ultra revises. The **citation gate** blocks export unless every quote matches its source word for word.
7. **Deadlines** come from a fixed table checked against federal regulations, never from a model.
""")
footer()
