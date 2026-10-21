#!/usr/bin/env python3
"""Extract criteria from L34220 v40 with a model and score recall against the gold anchors.

Usage: ./.venv/bin/python scripts/check_criteria.py [model[:nothink] ...]   (default: Lightning and Super)
"""

import json
import sys
import time
from datetime import date

from nebius_nvidia.cms import cms
from nebius_nvidia.cost import CostTracker
from nebius_nvidia.criteria import extract_criteria, recall_against_gold
from nebius_nvidia.llm import LIGHTNING, SUPER

gold = json.load(open("eval/gold/L34220_v40.json"))
doc = cms().lcd_on(34220, date(2026, 8, 14))
assert doc.version == gold["version"], doc.version

for arg in sys.argv[1:] or [LIGHTNING, SUPER]:
    model, _, flag = arg.partition(":")
    thinking = False if flag == "nothink" else None
    tracker, t0 = CostTracker(), time.time()
    try:
        crit = extract_criteria(doc, model=model, tracker=tracker, use_cache=False, thinking=thinking)
    except Exception as e:  # noqa: BLE001 - comparison script; report and continue
        print(f"\n=== {arg}: FAILED {type(e).__name__}: {str(e)[:200]} ({time.time() - t0:.0f}s)")
        continue
    recall = recall_against_gold(crit, doc, gold["anchors"])
    verified = sum(c.span_verified for c in crit)
    print(f"\n=== {arg}: {len(crit)} criteria, {verified} spans verified, "
          f"gold recall {sum(recall.values())}/{len(recall)}, ${tracker.total_usd:.4f}, {time.time() - t0:.0f}s, "
          f"attempts {[s.attempts for s in tracker.steps]}")
    for c in crit:
        print(f"  {c.criterion_id} [{c.kind}] {'✓' if c.span_verified else '✗'} {c.summary[:90]}")
    print("  missed gold:", [g for g, ok in recall.items() if not ok] or "none")
