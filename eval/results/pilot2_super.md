## Eval `pilot2_super`: 5 cases scored, 0 skipped, 0 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 5/5 (100%) |
| Verdict accuracy | 4/5 (80%) |
| Gold-criterion status accuracy | 35/35 (100%) |
| Mean cost per case | $0.0191 |
| Mean latency per case | 70 s |

Per gold criterion (correct / total):
- G1_red_flag_indication: 5/5
- G2_red_flag_list: 5/5
- G3_first_month: 5/5
- G4_four_weeks_conservative: 5/5
- G5_ddd_hnp_no_surgery: 5/5
- G6_findings_affect_treatment: 5/5
- G7_duplication: 5/5

Verdict misses:
- case_018 [D_red_flag_early]: expected appeal, got dont_appeal
