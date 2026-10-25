#!/usr/bin/env python3
"""Build the public demo's precomputed case runs (demo/runs/case_*.json).

Runs the full pipeline (scanned letter → Super-VL, appeal drafting included) on
one showcase case per scenario group, so the public demo costs $0 to browse.
With --checks, runs prevention mode on the same charts as prior-auth requests
(demo/checks/case_*.json).

Usage: ./.venv/bin/python scripts/precompute.py [case_001 case_015 ...] [--workers 3] [--checks]
"""

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from nebius_nvidia.pipeline import run_case
from nebius_nvidia.prevention import check_request
from nebius_nvidia.scenario import Scenario

SHOWCASE = ["case_001", "case_015", "case_018", "case_009", "case_023", "case_027", "case_028"]
CHECK_SHOWCASE = ["case_001", "case_018", "case_009", "case_023"]  # ready, red flag, two "not yet"
OUT = Path("demo/runs")
CHECKS = Path("demo/checks")


def build(case_id: str) -> str:
    run, _ = run_case(Path("cases") / case_id)
    (OUT / f"{case_id}.json").write_text(run.model_dump_json())
    expected = Scenario.load(Path("cases") / case_id).expected.verdict
    gate = "" if not run.gate else (" gate PASS" if run.gate.ok else " gate BLOCKED")
    flag = "" if run.verdict == expected else f"  ≠ expected {expected}"
    return f"{case_id}: {run.verdict}{gate}  ${run.cost_usd:.4f}{flag}"


def build_check(case_id: str) -> str:
    ch = check_request(Path("cases") / case_id)
    (CHECKS / f"{case_id}.json").write_text(ch.model_dump_json())
    return f"{case_id}: {ch.readiness}" + (f" earliest {ch.earliest}" if ch.earliest else "") + f"  ${ch.cost_usd:.4f}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cases", nargs="*", default=SHOWCASE)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--checks", action="store_true", help="build prior-auth checks instead of denial runs")
    args = ap.parse_args()
    if args.checks:
        CHECKS.mkdir(parents=True, exist_ok=True)
        with ThreadPoolExecutor(args.workers) as pool:
            for line in pool.map(build_check, args.cases if args.cases != SHOWCASE else CHECK_SHOWCASE):
                print(line)
        return
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(args.workers) as pool:
        for line in pool.map(build, args.cases):
            print(line)
    print(json.dumps({"runs": sorted(p.stem for p in OUT.glob("case_*.json"))}))


if __name__ == "__main__":
    main()
