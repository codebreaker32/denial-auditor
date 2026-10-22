#!/usr/bin/env python3
"""Build the public demo's precomputed case runs (demo/runs/case_*.json).

Runs the full pipeline (scanned letter → Super-VL, appeal drafting included) on
one showcase case per scenario group, so the public demo costs $0 to browse.

Usage: ./.venv/bin/python scripts/precompute.py [case_001 case_015 ...] [--workers 3]
"""

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from nebius_nvidia.pipeline import run_case
from nebius_nvidia.scenario import Scenario

SHOWCASE = ["case_001", "case_015", "case_018", "case_009", "case_023", "case_027", "case_028"]
OUT = Path("demo/runs")


def build(case_id: str) -> str:
    run, _ = run_case(Path("cases") / case_id)
    (OUT / f"{case_id}.json").write_text(run.model_dump_json())
    expected = Scenario.load(Path("cases") / case_id).expected.verdict
    gate = "" if not run.gate else (" gate PASS" if run.gate.ok else " gate BLOCKED")
    flag = "" if run.verdict == expected else f"  ≠ expected {expected}"
    return f"{case_id}: {run.verdict}{gate}  ${run.cost_usd:.4f}{flag}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cases", nargs="*", default=SHOWCASE)
    ap.add_argument("--workers", type=int, default=3)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(args.workers) as pool:
        for line in pool.map(build, args.cases):
            print(line)
    print(json.dumps({"runs": sorted(p.stem for p in OUT.glob("case_*.json"))}))


if __name__ == "__main__":
    main()
