#!/usr/bin/env python3
"""Run the pipeline over the synthetic cases and score it against the scenarios' ground truth.

Scores:
  - route accuracy (triage), verdict accuracy;
  - per gold criterion: the status of the extracted criterion whose span contains the
    gold anchor vs the scenario's expected status (L34220 cases);
  - cost and latency per case.

Usage:
  ./.venv/bin/python eval/run_eval.py --matcher nano --groups A,C,D,E --text --workers 3 --tag nano
Writes eval/results/<tag>.json and prints a markdown summary.
"""

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from nebius_nvidia.llm import NANO, SUPER, ULTRA
from nebius_nvidia.pipeline import UnsupportedPolicy, run_case
from nebius_nvidia.scenario import Scenario
from nebius_nvidia.text import locate

MODELS = {"nano": NANO, "super": SUPER, "ultra": ULTRA}
GOLD = json.loads(Path("eval/gold/L34220_v40.json").read_text())["anchors"]


def gold_statuses(run) -> dict[str, str]:
    """For each gold anchor, the matched status of the criterion whose span contains it."""
    if not run.policy:
        return {}
    by_id = {m.criterion_id: m.status for m in run.matches}
    out = {}
    for gid, anchor in GOLD.items():
        hit = locate(anchor, run.policy.text)
        crit = next((c for c in run.criteria if hit and c.span_verified and c.span_start <= hit[0] and hit[1] <= c.span_end), None)
        out[gid] = by_id.get(crit.criterion_id, "unmatched") if crit else "not_extracted"
    return out


def eval_case(case_dir: Path, matcher: str, use_text: bool) -> dict:
    s = Scenario.load(case_dir)
    t0 = time.time()
    try:
        run, facts = run_case(case_dir, use_text=use_text, matcher=matcher, with_appeal=False)
    except UnsupportedPolicy as e:
        return {"case": s.case_id, "group": s.group, "skipped": str(e)}
    except Exception as e:  # noqa: BLE001 - keep the eval going; record the failure
        return {"case": s.case_id, "group": s.group, "error": f"{type(e).__name__}: {str(e)[:300]}"}
    got = gold_statuses(run)
    gold_cmp = {g: {"expected": exp, "got": got.get(g)} for g, exp in s.expected.gold.items() if g in GOLD}
    return {
        "case": s.case_id,
        "group": s.group,
        "route_expected": s.expected.route,
        "route_got": run.triage.route,
        "verdict_expected": s.expected.verdict,
        "verdict_got": run.verdict,
        "gold": gold_cmp,
        "cost_usd": run.cost_usd,
        "latency_s": round(time.time() - t0, 1),
        "unverified_facts": facts.unverified if facts else [],
        "run": json.loads(run.model_dump_json()),
    }


def summarize(results: list[dict], tag: str) -> str:
    done = [r for r in results if "verdict_got" in r]
    lines = [f"## Eval `{tag}`: {len(done)} cases scored, "
             f"{sum('skipped' in r for r in results)} skipped, {sum('error' in r for r in results)} errors\n"]
    if not done:
        return "\n".join(lines)
    route = sum(r["route_got"] == r["route_expected"] for r in done)
    verdict = sum(r["verdict_got"] == r["verdict_expected"] for r in done)
    gold = [(g, v) for r in done for g, v in r["gold"].items()]
    gold_ok = sum(v["got"] == v["expected"] for _, v in gold)
    cost = sum(r["cost_usd"] for r in done) / len(done)
    lat = sum(r["latency_s"] for r in done) / len(done)
    lines += [
        "| Metric | Value |", "|---|---|",
        f"| Triage route accuracy | {route}/{len(done)} ({route / len(done):.0%}) |",
        f"| Verdict accuracy | {verdict}/{len(done)} ({verdict / len(done):.0%}) |",
        f"| Gold-criterion status accuracy | {gold_ok}/{len(gold)} ({gold_ok / max(1, len(gold)):.0%}) |",
        f"| Mean cost per case | ${cost:.4f} |",
        f"| Mean latency per case | {lat:.0f} s |",
        "",
        "Per gold criterion (correct / total):",
    ]
    for gid in GOLD:
        rows = [v for g, v in gold if g == gid]
        if rows:
            wrong = [f"{v['expected']}→{v['got']}" for v in rows if v["got"] != v["expected"]]
            lines.append(f"- {gid}: {len(rows) - len(wrong)}/{len(rows)}" + (f"  (misses: {', '.join(wrong)})" if wrong else ""))
    lines.append("\nVerdict misses:")
    for r in done:
        if r["verdict_got"] != r["verdict_expected"]:
            lines.append(f"- {r['case']} [{r['group']}]: expected {r['verdict_expected']}, got {r['verdict_got']}")
    for r in results:
        if "error" in r:
            lines.append(f"- ERROR {r['case']}: {r['error']}")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default="cases")
    ap.add_argument("--matcher", default="nano", choices=MODELS)
    ap.add_argument("--groups", default="", help="comma-separated group letters, e.g. A,C,D,E")
    ap.add_argument("--only", default="")
    ap.add_argument("--text", action="store_true", help="read letter.txt (Nano) instead of the scan (Super-VL)")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--tag", default="")
    args = ap.parse_args()

    dirs = sorted(d for d in Path(args.cases).iterdir() if (d / "notes.json").exists())
    if args.groups:
        letters = set(args.groups.split(","))
        dirs = [d for d in dirs if Scenario.load(d).group.split("_")[0] in letters]
    if args.only:
        dirs = [d for d in dirs if d.name in args.only.split(",")]
    tag = args.tag or f"{args.matcher}{'_text' if args.text else ''}"
    with ThreadPoolExecutor(args.workers) as pool:
        results = list(pool.map(lambda d: eval_case(d, MODELS[args.matcher], args.text), dirs))
    out = Path("eval/results")
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{tag}.json").write_text(json.dumps(results, indent=1, default=str))
    md = summarize(results, tag)
    (out / f"{tag}.md").write_text(md + "\n")
    print(md)


if __name__ == "__main__":
    main()
