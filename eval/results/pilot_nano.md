## Eval `pilot_nano`: 5 cases scored, 0 skipped, 0 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 5/5 (100%) |
| Verdict accuracy | 1/5 (20%) |
| Gold-criterion status accuracy | 20/35 (57%) |
| Mean cost per case | $0.0083 |
| Mean latency per case | 192 s |

Per gold criterion (correct / total):
- G1_red_flag_indication: 5/5
- G2_red_flag_list: 2/5  (misses: not_applicable→not_met, not_applicable→not_met, not_applicable→not_met)
- G3_first_month: 0/5  (misses: met→not_applicable, met→not_applicable, met→not_met, met→not_applicable, not_met→met)
- G4_four_weeks_conservative: 5/5
- G5_ddd_hnp_no_surgery: 3/5  (misses: not_applicable→met, not_applicable→not_met)
- G6_findings_affect_treatment: 0/5  (misses: met→not_applicable, met→not_met, met→not_applicable, met→not_applicable, met→not_applicable)
- G7_duplication: 5/5

Verdict misses:
- case_001 [A_ma_met]: expected appeal, got dont_appeal
- case_002 [A_ma_met]: expected appeal, got dont_appeal
- case_015 [C_ma_xray_demand]: expected appeal, got dont_appeal
- case_018 [D_red_flag_early]: expected appeal, got dont_appeal
