## Eval `super_b_v3`: 3 cases scored, 0 skipped, 2 errors

| Metric | Value |
|---|---|
| Triage route accuracy | 3/3 (100%) |
| Verdict accuracy | 3/3 (100%) |
| Gold-criterion status accuracy | 1/3 (33%) |
| Mean cost per case | $0.0302 |
| Mean latency per case | 165 s |

Per gold criterion (correct / total):
- A1_radiculopathy_6_weeks: 1/3  (misses: not_met→missing_documentation, not_met→missing_documentation)

Verdict misses:
- ERROR case_011: InternalServerError: Error code: 529 - {'error': {'type': 'server_error', 'message': 'worker overloaded', 'param': None, 'code': None}, 'detail': 'worker overloaded'}
- ERROR case_013: InternalServerError: Error code: 529 - {'error': {'type': 'server_error', 'message': 'worker overloaded', 'param': None, 'code': None}, 'detail': 'worker overloaded'}
