## Eval `super_b_v3b`: 2 cases scored, 0 skipped, 0 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 2/2 (100%) |
| Verdict accuracy | 1/2 (50%) |
| Gold-criterion status accuracy | 1/2 (50%) |
| Mean cost per case | $0.0305 |
| Mean latency per case | 70 s |

Per gold criterion (correct / total):
- A1_radiculopathy_6_weeks: 1/2  (misses: not_met→missing_documentation)

Verdict misses:
- case_011 [B_aetna_5_of_6_weeks]: expected dont_appeal, got doc_request
