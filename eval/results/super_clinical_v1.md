## Eval `super_clinical_v1`: 24 cases scored, 0 skipped, 0 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 24/24 (100%) |
| Verdict accuracy | 18/24 (75%) |
| Gold-criterion status accuracy | 126/138 (91%) |
| Mean cost per case | $0.0211 |
| Mean latency per case | 80 s |

Per gold criterion (correct / total):
- G1_red_flag_indication: 18/19  (misses: met→not_applicable)
- G2_red_flag_list: 18/19  (misses: met→not_applicable)
- G3_first_month: 17/19  (misses: clear→not_met, not_met→not_applicable)
- G4_four_weeks_conservative: 18/19  (misses: not_applicable→not_met)
- G5_ddd_hnp_no_surgery: 19/19
- G6_findings_affect_treatment: 19/19
- G7_duplication: 17/19  (misses: clear→missing_documentation, clear→missing_documentation)
- A1_radiculopathy_6_weeks: 0/5  (misses: not_met→not_applicable, not_met→not_applicable, not_met→not_applicable, not_met→not_applicable, not_met→not_applicable)

Verdict misses:
- case_002 [A_ma_met]: expected appeal, got doc_request
- case_007 [A_ma_met]: expected appeal, got doc_request
- case_009 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
- case_011 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
- case_012 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
- case_021 [D_red_flag_early]: expected appeal, got dont_appeal
