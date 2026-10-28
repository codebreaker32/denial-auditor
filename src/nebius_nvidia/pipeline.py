"""End-to-end case run: letter → triage → policy (version on DOS) → criteria → facts → match → verdict.

CLI:  ./.venv/bin/python -m nebius_nvidia.pipeline cases/case_001 [--text] [--json out.json]
      (--text reads letter.txt with Nano instead of the scanned letter.png with Super-VL)
"""

import argparse
import json
import re
import time
from collections import Counter
from datetime import date
from pathlib import Path

from nebius_nvidia.aetna import lumbar_mri_policy
from nebius_nvidia.appeal import documentation_request, draft_appeal
from nebius_nvidia.cms import cms
from nebius_nvidia.cost import CostTracker
from nebius_nvidia.criteria import extract_criteria
from nebius_nvidia.facts import ChartFacts, extract_facts, facts_view
from nebius_nvidia.intake import read_denial
from nebius_nvidia.match import match_all, verdict
from nebius_nvidia.models import CaseRun, ChartNote, Denial, PolicyDoc
from nebius_nvidia.rules import deadline
from nebius_nvidia.scenario import Scenario
from nebius_nvidia.text import segment
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


def resolve_policy(plan_type: str, payer_name: str, dos: date, practice_state: str | None) -> PolicyDoc:
    if plan_type in ("MA", "MEDICARE_FFS"):
        lcd = LUMBAR_MRI_LCD.get(practice_state or "")
        if not lcd:
            raise UnsupportedPolicy(f"No Medicare LCD configured for lumbar MRI in {practice_state!r}")
        return cms().lcd_on(lcd, dos)
    if "aetna" in payer_name.lower():
        return lumbar_mri_policy()  # located at runtime with Tavily search
    raise UnsupportedPolicy(f"Commercial policy lookup for {payer_name!r} is not configured yet")


def load_notes(case_dir: Path) -> list[ChartNote]:
    return [ChartNote.model_validate(n) for n in json.loads((case_dir / "notes.json").read_text())]


# Live-run steps, in order; an event's `step` is an index into this list.
STEPS = ["intake", "triage", "policy", "criteria", "facts", "match", "appeal", "done"]

PLAN_WORDS = {"MA": "Medicare Advantage", "MEDICARE_FFS": "Medicare", "COMMERCIAL_ACA": "commercial",
              "COMMERCIAL_ERISA": "employer plan", "MEDICAID": "Medicaid", "UNKNOWN": "plan type unknown"}
ROUTE_WORDS = {
    "clinical_review": "Medical-necessity denial: the chart gets checked against the payer's policy",
    "fix_checklist": "Administrative denial: fix the claim and resubmit, no clinical review needed",
    "not_winnable": "The plan excludes this service, so medical evidence won't change the outcome",
}
KIND_WORDS = {"indication": "ways to qualify", "red_flag": "red-flag rules", "duration": "waiting periods",
              "documentation": "documentation rules", "exclusion": "exclusions"}
VERDICT_WORDS = {
    "appeal": "Recommendation: appeal. The letter is ready for a person to review and send",
    "doc_request": "Recommendation: ask the physician for the missing documentation before appealing",
    "fix_checklist": "Recommendation: fix the claim and resubmit; no appeal is needed",
    "dont_appeal": "Recommendation: don't appeal yet. The chart doesn't meet the policy",
    "not_winnable": "Recommendation: not winnable. The plan excludes this service",
}


def day(d: date | None) -> str:
    return f"{d:%b} {d.day}, {d.year}" if d else "date unknown"


def plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def short_rule(summary: str, words: int = 8) -> str:
    """A rule's display name from our paraphrase: its first clause, at most `words` words."""
    clause = summary.strip().rstrip(".").split(";")[0].split(" (")[0].strip()
    w = clause.split()
    return " ".join(w[:words]).rstrip(",:") + ("…" if len(w) > words else "")


def criterion_addresses(policy: PolicyDoc, criteria: list) -> dict[str, str]:
    """§ address of each criterion (its sentence numbers in the fetched policy), as the case view shows them."""
    units = segment(policy.text)
    out = {}
    for c in criteria:
        if not (c.span_verified and c.span_start is not None and c.span_end is not None):
            continue
        ns = [i for i, (a, b) in enumerate(units, 1) if c.span_start <= a and b <= c.span_end]
        if ns:
            out[c.criterion_id] = f"§{ns[0]}" + (f"–{ns[-1]}" if len(ns) > 1 else "")
    return out


def denial_line(d: Denial) -> str:
    payer = re.sub(r"\s*\(synthetic[^)]*\)", "", d.payer_name, flags=re.I).replace("Medicare Advantage", "MA")
    codes = ", ".join(d.carc)
    reason = f"reason code{'s' if len(d.carc) > 1 else ''} {codes}" if d.carc else "no reason code on the letter"
    return f"Read the denial: {payer} · CPT {d.cpt} · service {day(d.dos)} · {reason}"


def facts_line(facts: ChartFacts, notes: list[ChartNote]) -> str:
    d, ev = facts.draft, facts.evidence
    parts = [f"Chart: {plural(len(notes), 'note')}"]
    onset_ok = d.onset and d.onset.date and ev.get("onset") and ev["onset"].verified
    parts.append(f"onset {day(d.onset.date)}" if onset_ok else "no onset date")
    if facts.conservative_days is not None:
        n = facts.conservative_days
        parts.append(f"{n} days of dated care" if n < 14 else f"{n / 7:.1f}".rstrip("0").rstrip(".") + " weeks of dated care")
    else:
        parts.append("no dated therapy")
    flags = [r.flag for i, r in enumerate(d.red_flags) if ev.get(f"red_flag_{i}") and ev[f"red_flag_{i}"].verified]
    parts.append(f"red flag: {', '.join(flags)}" if flags else "no red flags")
    return " · ".join(parts)


def run_case(case_dir: Path, use_text: bool = False, as_of: date | None = None, matcher: str | None = None,
             with_appeal: bool = True, progress=None, votes: int = 2, on_event=None) -> tuple[CaseRun, ChartFacts | None]:
    """Run one case. `progress(message)` is called before each step (used by the live UI).

    `on_event(event)` receives the live activity feed: dicts {at, step, kind, text, status?, ref?, ...}
    where kind is start (a step begins), detail (what it found), rule (one rule checked) or done.
    Lines are plain biller language: no model names, no costs.
    """
    case_dir = Path(case_dir)
    scenario = Scenario.load(case_dir)
    tracker = CostTracker()
    say = progress or (lambda msg: None)
    t0 = time.monotonic()
    step = 0

    def emit(kind: str, text: str, **extra) -> None:
        if on_event:
            on_event({"at": round(time.monotonic() - t0, 1), "step": step, "kind": kind, "text": text,
                      **{k: v for k, v in extra.items() if v is not None}})

    def begin(name: str, message: str, plain: str) -> None:
        nonlocal step
        step = STEPS.index(name)
        say(message)
        emit("start", plain)

    begin("intake", "Reading the denial letter (Nemotron 3.5 Super-VL)" if not use_text else "Reading the denial letter (Nemotron 3 Nano)",
          "Reading the faxed denial letter" if not use_text else "Reading the denial letter")
    denial = read_denial(case_dir / ("letter.txt" if use_text else "letter.png"), tracker=tracker,
                         practice_state=scenario.practice_state)
    emit("detail", denial_line(denial))
    emit("detail", f"Plan: {PLAN_WORDS.get(denial.plan_type, denial.plan_type)}"
         + (f" · practice in {denial.practice_state}" if denial.practice_state else ""))
    begin("triage", "Triage by reason code", "Sorting the denial by the payer's reason")
    tri = triage(denial, tracker=tracker)
    emit("detail", ROUTE_WORDS[tri.route] + (" (from the reason-code table)" if tri.method == "carc_table"
                                             else " (read from the letter's wording; no reason code matched)"))
    run = CaseRun(case_id=scenario.case_id, denial=denial, triage=tri, verdict="fix_checklist",
                  deadline=deadline(denial.plan_type, denial.notice_date, today=as_of or review_date(denial)))
    facts = None
    if tri.route == "clinical_review":
        medicare = denial.plan_type in ("MA", "MEDICARE_FFS")
        begin("policy", "Finding the policy in effect on the date of service" + (" (CMS Coverage API)" if medicare else " (Tavily search)"),
              f"Asking the CMS coverage database for the version in effect on {day(denial.dos)}" if medicare
              else f"Searching the web for {denial.payer_name.split(' (')[0]}'s current policy")
        policy = resolve_policy(denial.plan_type, denial.payer_name, denial.dos, scenario.practice_state)
        if policy.version_basis == "api-versioned":
            emit("detail", f"Medicare policy {policy.policy_id} version {policy.version}, in effect on the service date"
                 + (f" (effective {day(policy.effective_from)})" if policy.effective_from else ""), ref=policy.policy_id)
        else:
            emit("detail", f"Aetna {policy.policy_id} · snapshot fetched {day(policy.fetched_at.date())} · found with a web search"
                 if policy.source == "aetna-cpb" else f"{policy.policy_id} · snapshot fetched {day(policy.fetched_at.date())}",
                 ref=policy.policy_id)
        begin("criteria", "Splitting the policy into rules (Nemotron 3 Super picks sentences)",
              "Reading the policy sentence by sentence and listing what it requires")
        criteria = extract_criteria(policy, tracker=tracker)
        emit("detail", f"Found {plural(len(criteria), 'rule')} in the policy")
        kinds = Counter(c.kind for c in criteria)
        if kinds:
            emit("detail", " · ".join(f"{n} {KIND_WORDS.get(k, k)}" for k, n in kinds.most_common()))
        notes = load_notes(case_dir)
        begin("facts", "Extracting chart facts with verified quotes (Nemotron 3 Nano)",
              f"Reading {plural(len(notes), 'chart note')} for dates, treatments and red flags")
        facts = extract_facts(notes, denial.dos, tracker=tracker)
        emit("detail", facts_line(facts, notes))
        if facts.unverified:
            emit("detail", f"{plural(len(facts.unverified), 'quote')} couldn't be found word for word in the notes, so "
                 + ("it was" if len(facts.unverified) == 1 else "they were") + " left out")
        run.policy, run.criteria = policy, criteria
        run.facts = facts_view(facts, notes)
        begin("match", f"Checking {len(criteria)} rules against the chart (2 Nemotron 3 Super votes each; Ultra breaks ties)",
              f"Checking {plural(len(criteria), 'rule')} against the chart, each one twice")
        refs = criterion_addresses(policy, criteria)

        def done_rule(c, m) -> None:
            emit("rule", short_rule(c.summary), status=m.status, ref=refs.get(c.criterion_id), id=c.criterion_id,
                 summary=c.summary, span=c.verbatim_span[:240], total=len(criteria))
            if m.confidence == "escalated":
                emit("detail", "Second look settled this one", id=c.criterion_id)

        run.matches = match_all(criteria, notes, facts, denial.dos, tracker=tracker, cpt=denial.cpt, votes=votes,
                                on_done=done_rule if on_event else None, **({"model": matcher} if matcher else {}))
    run.verdict = verdict(tri, run.matches, run.criteria)
    if with_appeal and run.verdict == "appeal":
        begin("appeal", "Drafting the appeal (Ultra), payer-reviewer critique (Super), revision (Ultra), citation gate",
              "Drafting the appeal letter")
        run.appeal, _bank, run.gate = draft_appeal(run, load_notes(case_dir), scenario.patient_name, tracker=tracker,
                                                   on_step=lambda text: emit("detail", text))
    elif run.verdict == "doc_request":
        run.doc_request = documentation_request(run, scenario.patient_name)
    run.trace = tracker.steps
    say(f"Done: {run.verdict.replace('_', ' ')} · ${run.cost_usd:.4f}")
    step = STEPS.index("done")
    words = VERDICT_WORDS[run.verdict]
    if run.verdict == "appeal" and run.gate and not run.gate.ok:
        words = "Recommendation: appeal, but the letter stays blocked until every quote matches"
    elif run.verdict == "doc_request":
        missing = sum(m.status == "missing_documentation" for m in run.matches)
        words += f" ({plural(missing, 'item')} to request)" if missing else ""
    emit("done", words, verdict=run.verdict)
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
