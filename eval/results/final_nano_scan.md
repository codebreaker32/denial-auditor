## Eval `final_nano_scan`: 29 cases scored, 0 skipped, 1 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 29/29 (100%) |
| Verdict accuracy | 16/29 (55%) |
| Gold-criterion status accuracy | 119/131 (91%) |
| Mean cost per case | $0.0098 |
| Mean latency per case | 90 s |

Per gold criterion (correct / total):
- G1_red_flag_indication: 10/18  (misses: not_applicable→not_met, not_applicable→not_met, not_applicable→not_met, not_applicable→not_met, not_applicable→not_met, met→not_met, not_applicable→not_met, not_applicable→not_met)
- G2_red_flag_list: 18/18
- G3_first_month: 18/18
- G4_four_weeks_conservative: 15/18  (misses: met→missing_documentation, met→missing_documentation, met→missing_documentation)
- G5_ddd_hnp_no_surgery: 17/18  (misses: clear→not_met)
- G6_findings_affect_treatment: 18/18
- G7_duplication: 18/18
- A1_radiculopathy_6_weeks: 5/5

Verdict misses:
- case_003 [A_ma_met]: expected appeal, got doc_request
- case_005 [A_ma_met]: expected appeal, got doc_request
- case_006 [A_ma_met]: expected appeal, got doc_request
- case_007 [A_ma_met]: expected appeal, got doc_request
- case_008 [A_ma_met]: expected appeal, got doc_request
- case_014 [C_ma_xray_demand]: expected appeal, got dont_appeal
- case_015 [C_ma_xray_demand]: expected appeal, got doc_request
- case_016 [C_ma_xray_demand]: expected appeal, got doc_request
- case_017 [C_ma_xray_demand]: expected appeal, got dont_appeal
- case_018 [D_red_flag_early]: expected appeal, got doc_request
- case_019 [D_red_flag_early]: expected appeal, got doc_request
- case_020 [D_red_flag_early]: expected appeal, got doc_request
- case_021 [D_red_flag_early]: expected appeal, got dont_appeal
- ERROR case_001: LLMFormatError: match:C7:v1: nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B gave no valid output after 2 attempts: 1 validation error for MatchDraft
  Invalid JSON: EOF while parsing a string at line 3 column 19464 [type=json_invalid, input_value='{\n  "status": "met",\n ...The patient had a trial', input_type=str]
    For 
