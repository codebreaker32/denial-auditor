"""End-to-end case run: letter → triage → policy (version on DOS) → criteria → facts → match → verdict.

CLI:  ./.venv/bin/python -m nebius_nvidia.pipeline cases/case_001 [--text] [--json out.json]
      (--text reads letter.txt with Nano instead of the scanned letter.png with Super-VL)
"""

import argparse
import json
from datetime import date
from pathlib import Path

from nebius_nvidia.appeal import documentation_request, draft_appeal
from nebius_nvidia.cms import cms
from nebius_nvidia.cost import CostTracker
from nebius_nvidia.criteria import extract_criteria
from nebius_nvidia.facts import ChartFacts, extract_facts
from nebius_nvidia.intake import read_denial
from nebius_nvidia.match import match_all, verdict
from nebius_nvidia.models import CaseRun, ChartNote, Denial, PolicyDoc
from nebius_nvidia.rules import deadline
from nebius_nvidia.scenario import Scenario
from nebius_nvidia.triage import triage

# Medicare LCDs for lumbar MRI by practice state. Noridian (JE + JF) publishes L34220;
# other MACs' LCDs are not configured yet.
NORIDIAN_STATES = {"AK", "AZ", "CA", "HI", "ID", "MT", "ND", "NV", "OR", "SD", "UT", "WA", "WY"}
LUMBAR_MRI_LCD = {state: 34220 for state in NORIDIAN_STATES}


def review_date(denial: Denial) -> date:
    """Synthetic cases are reviewed a week after the notice, so deadlines stay meaningful in demos."""
    from datetime import timedelta

    return denial.notice_date + timedelta(days=7)


class UnsupportedPolicy(LookupError):
    pass


def resolve_policy(denial: Denial, practice_state: str | None) -> PolicyDoc:
    if denial.plan_type in ("MA", "MEDICARE_FFS"):
        lcd = LUMBAR_MRI_LCD.get(practice_state or "")
        if not lcd:
            raise UnsupportedPolicy(f"No Medicare LCD configured for lumbar MRI in {practice_state!r}")
        return cms().lcd_on(lcd, denial.dos)
    raise UnsupportedPolicy(f"Commercial policy lookup for {denial.payer_name!r} is not wired in yet")


def load_notes(case_dir: Path) -> list[ChartNote]:
    return [ChartNote.model_validate(n) for n in json.loads((case_dir / "notes.json").read_text())]


def run_case(case_dir: Path, use_text: bool = False, as_of: date | None = None, matcher: str | None = None,
             with_appeal: bool = True) -> tuple[CaseRun, ChartFacts | None]:
    case_dir = Path(case_dir)
    scenario = Scenario.load(case_dir)
    tracker = CostTracker()

    denial = read_denial(case_dir / ("letter.txt" if use_text else "letter.png"), tracker=tracker,
                         practice_state=scenario.practice_state)
    tri = triage(denial, tracker=tracker)
    run = CaseRun(case_id=scenario.case_id, denial=denial, triage=tri, verdict="fix_checklist",
                  deadline=deadline(denial.plan_type, denial.notice_date, today=as_of or review_date(denial)))
    facts = None
    if tri.route == "clinical_review":
        policy = resolve_policy(denial, scenario.practice_state)
        criteria = extract_criteria(policy, tracker=tracker)
        notes = load_notes(case_dir)
        facts = extract_facts(notes, denial.dos, tracker=tracker)
        run.policy, run.criteria = policy, criteria
        run.matches = match_all(criteria, notes, facts, denial.dos, tracker=tracker, cpt=denial.cpt,
                                **({"model": matcher} if matcher else {}))
    run.verdict = verdict(tri, run.matches)
    if with_appeal and run.verdict == "appeal":
        run.appeal, _bank, run.gate = draft_appeal(run, load_notes(case_dir), scenario.patient_name, tracker=tracker)
    elif run.verdict == "doc_request":
        run.doc_request = documentation_request(run, scenario.patient_name)
    run.trace = tracker.steps
    return run, facts


ICON = {"met": "✅", "not_met": "❌", "missing_documentation": "⚠️ ", "not_applicable": "·"}


def print_board(run: CaseRun, facts: ChartFacts | None) -> None:
    d = run.denial
    print(f"\n{run.case_id}  {d.payer_name}  [{d.plan_type}]  CPT {d.cpt}  DOS {d.dos}  reason codes {d.carc}")
    print(f"Triage: {run.triage.route} ({run.triage.method}) {run.triage.explanation}")
    for item in run.triage.checklist:
        print(f"  - {item}")
    if run.policy:
        print(f"Policy: {run.policy.title}, {run.policy.citation()} ({run.policy.url})")
    if facts:
        print("Facts:\n  " + facts.summary().replace("\n", "\n  "))
        if facts.unverified:
            print(f"  (unverified fact quotes: {facts.unverified})")
    by_id = {c.criterion_id: c for c in run.criteria}
    for m in run.matches:
        c = by_id[m.criterion_id]
        if m.status == "not_applicable":
            continue
        print(f"\n{ICON[m.status]} {c.criterion_id} [{c.kind}] {c.summary}")
        print(f"    policy: \"{c.verbatim_span[:160]}{'…' if len(c.verbatim_span) > 160 else ''}\"")
        for e in m.evidence:
            print(f"    chart{'' if e.verified else ' (UNVERIFIED)'}: \"{e.quote[:140]}\" [{e.note_id}]")
        print(f"    → {m.rationale}")
    na = sum(m.status == "not_applicable" for m in run.matches)
    if na:
        print(f"\n(· {na} criteria not applicable to this case)")
    dl = run.deadline
    print(f"\nVERDICT: {run.verdict.upper()}")
    if run.doc_request:
        print("\n" + run.doc_request)
    if run.appeal:
        print(f"\n----- APPEAL (revision {run.appeal.revision}; {len(run.appeal.critique)} critique items addressed) -----")
        print(run.appeal.rendered)
        g = run.gate
        print(f"----- CITATION GATE: {'PASS — export enabled' if g.ok else 'BLOCKED — ' + g.reason} -----")
        for c in g.checks:
            print(f"  {'✓' if c.status == 'verified' else '✗'} {c.text[:90]!r} {c.source_id or ''}")
    if dl:
        print(f"Deadline: {dl.due} ({dl.days_left} days left as of review) — {dl.citation} {'' if dl.verified else '(UNVERIFIED)'}")
    by_model: dict[str, float] = {}
    for s in run.trace:
        by_model[s.model.split('/')[-1]] = by_model.get(s.model.split('/')[-1], 0) + s.cost_usd
    print(f"Cost: ${run.cost_usd:.4f}  " + "  ".join(f"{k} ${v:.4f}" for k, v in by_model.items()))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("case_dir")
    ap.add_argument("--text", action="store_true", help="read letter.txt with Nano instead of letter.png with Super-VL")
    ap.add_argument("--json", help="write the CaseRun as JSON here")
    ap.add_argument("--no-appeal", action="store_true", help="skip drafting the appeal letter")
    args = ap.parse_args()
    run, facts = run_case(Path(args.case_dir), use_text=args.text, with_appeal=not args.no_appeal)
    print_board(run, facts)
    if args.json:
        Path(args.json).write_text(run.model_dump_json(indent=1))


if __name__ == "__main__":
    main()
