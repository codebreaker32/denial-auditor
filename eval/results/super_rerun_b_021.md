## Eval `super_rerun_b_021`: 6 cases scored, 0 skipped, 0 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 6/6 (100%) |
| Verdict accuracy | 1/6 (17%) |
| Gold-criterion status accuracy | 11/12 (92%) |
| Mean cost per case | $0.0269 |
| Mean latency per case | 82 s |

Per gold criterion (correct / total):
- G1_red_flag_indication: 0/1  (misses: met→not_applicable)
- G2_red_flag_list: 1/1
- G3_first_month: 1/1
- G4_four_weeks_conservative: 1/1
- G5_ddd_hnp_no_surgery: 1/1
- G6_findings_affect_treatment: 1/1
- G7_duplication: 1/1
- A1_radiculopathy_6_weeks: 5/5

Verdict misses:
- case_009 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
- case_010 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
- case_011 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
- case_012 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
- case_013 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
