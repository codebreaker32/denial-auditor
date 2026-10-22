## Eval `pilot_super`: 5 cases scored, 0 skipped, 0 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 5/5 (100%) |
| Verdict accuracy | 2/5 (40%) |
| Gold-criterion status accuracy | 29/35 (83%) |
| Mean cost per case | $0.0184 |
| Mean latency per case | 70 s |

Per gold criterion (correct / total):
- G1_red_flag_indication: 5/5
- G2_red_flag_list: 1/5  (misses: not_applicable→not_met, not_applicable→met, not_applicable→not_met, not_applicable→not_met)
- G3_first_month: 4/5  (misses: not_met→met)
- G4_four_weeks_conservative: 5/5
- G5_ddd_hnp_no_surgery: 4/5  (misses: clear→not_met)
- G6_findings_affect_treatment: 5/5
- G7_duplication: 5/5

Verdict misses:
- case_001 [A_ma_met]: expected appeal, got dont_appeal
- case_015 [C_ma_xray_demand]: expected appeal, got dont_appeal
- case_018 [D_red_flag_early]: expected appeal, got dont_appeal
