## Eval `pilot2_nano`: 2 cases scored, 0 skipped, 3 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 2/2 (100%) |
| Verdict accuracy | 1/2 (50%) |
| Gold-criterion status accuracy | 13/14 (93%) |
| Mean cost per case | $0.0092 |
| Mean latency per case | 137 s |

Per gold criterion (correct / total):
- G1_red_flag_indication: 1/2  (misses: not_applicable→not_met)
- G2_red_flag_list: 2/2
- G3_first_month: 2/2
- G4_four_weeks_conservative: 2/2
- G5_ddd_hnp_no_surgery: 2/2
- G6_findings_affect_treatment: 2/2
- G7_duplication: 2/2

Verdict misses:
- case_018 [D_red_flag_early]: expected appeal, got dont_appeal
- ERROR case_001: HTTPStatusError: Server error '504 Gateway Timeout' for url 'https://api.coverage.cms.gov/v1/reports/local-coverage-final-lcds/'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504
- ERROR case_002: HTTPStatusError: Server error '504 Gateway Timeout' for url 'https://api.coverage.cms.gov/v1/reports/local-coverage-final-lcds/'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504
- ERROR case_015: HTTPStatusError: Server error '504 Gateway Timeout' for url 'https://api.coverage.cms.gov/v1/reports/local-coverage-final-lcds/'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504
