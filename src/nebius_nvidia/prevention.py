"""Prevention mode: check a prior-auth request against the payer's policy before it's submitted.

The same policy → criteria → facts → match steps as a denial, with no letter: the
request names the payer, plan, CPT and planned date of service, and the policy is
the version in effect on that date. The answer is one of
  ready             every rule that matters is met;
  add_documentation a route is met but something is undocumented (physician request);
  not_yet           the chart fails and falls short of a waiting period;
  doesnt_qualify    it fails for another reason.
For "not yet", code (not a model) works out the earliest date the waiting periods are
reached, assuming conservative care continues; the chart is re-checked before submitting.

CLI:  ./.venv/bin/python -m nebius_nvidia.prevention cases/case_009
"""

import argparse
from datetime import date, timedelta
from pathlib import Path

from nebius_nvidia.appeal import gap_request
from nebius_nvidia.cost import CostTracker
from nebius_nvidia.criteria import extract_criteria
from nebius_nvidia.facts import extract_facts, facts_view
from nebius_nvidia.match import clinical_verdict, match_all
from nebius_nvidia.models import FactsView, PriorAuthCheck, PriorAuthRequest
from nebius_nvidia.pipeline import load_notes, resolve_policy
from nebius_nvidia.scenario import Scenario

# Waiting periods each policy states, tied to the sentence that states it (the timeline draws these too).
# "from" is the clock start: symptom onset, or the first conservative treatment.
THRESHOLDS = {
    "L34220": [
        {"label": "1 month of symptoms", "from": "onset", "days": 30, "anchor": "the MRI may be appropriate after 1 month of symptoms"},
        {"label": "4 weeks of conservative care", "from": "treatment", "days": 28, "anchor": "conservative management lasting at least four weeks"},
    ],
    "Aetna CPB 0236": [
        {"label": "6 weeks of conservative therapy", "from": "treatment", "days": 42, "anchor": "no improvement after 6 weeks of conservative therapy"},
    ],
}

ASK = ("We're preparing a prior-authorization request for this MRI. Please check the chart for the items "
       "below and add an addendum if they were done:")


def earliest_date(policy_id: str, facts: FactsView, planned_dos: date) -> tuple[date | None, list[str]]:
    """When the chart, as documented, falls short of a waiting period: the date every period is reached.

    Symptom time counts from onset. Conservative care counts only documented days (first start to
    last end); a shortfall is made up from the last documented session, assuming care continues.
    Returns (None, []) when nothing falls short or a clock start isn't verified in the chart.
    """
    starts = [t.start for t in facts.treatments if t.start]
    ends = [t.end for t in facts.treatments if t.end]
    reached, basis, short = [], [], False
    for t in THRESHOLDS.get(policy_id, []):
        if t["from"] == "onset":
            if facts.onset is None:
                return None, []
            at = facts.onset + timedelta(days=t["days"])
            short |= at > planned_dos
            basis.append(f"{t['label']}: from onset {facts.onset:%m/%d/%Y}, reached {at:%m/%d/%Y}")
        else:
            if not starts or not ends:
                return None, []
            done = facts.conservative_days or 0
            if done >= t["days"]:
                at = min(starts) + timedelta(days=t["days"])
                basis.append(f"{t['label']}: met, {done} days documented")
            else:
                at = max(ends) + timedelta(days=t["days"] - done)
                short = True
                basis.append(f"{t['label']}: {done} of {t['days']} days documented; if care continues "
                             f"from {max(ends):%m/%d/%Y}, reached {at:%m/%d/%Y}")
        reached.append(at)
    return (max(reached), basis) if short else (None, [])


def decide(check: PriorAuthCheck, patient_name: str) -> PriorAuthCheck:
    """Readiness from the matched rules (a fixed rule, like a denial's verdict); no model call."""
    req, policy = check.request, check.policy
    check.readiness, check.earliest, check.earliest_basis, check.doc_request = "doesnt_qualify", None, [], None
    v = clinical_verdict(check.matches, check.criteria)
    if v == "appeal":
        check.readiness = "ready"
    elif v == "doc_request":
        check.readiness = "add_documentation"
        check.doc_request = gap_request(check.criteria, check.matches, patient_name, req.planned_dos,
                                        req.payer_name, policy, ASK)
    else:
        earliest, basis = earliest_date(policy.policy_id, check.facts, req.planned_dos)
        if earliest:
            check.readiness, check.earliest, check.earliest_basis = "not_yet", earliest, basis
    return check


def request_from_scenario(s: Scenario) -> PriorAuthRequest:
    return PriorAuthRequest(payer_name=s.payer, plan_type=s.plan_type, cpt=s.cpt, icd10=s.icd10,
                            planned_dos=s.dos, practice_state=s.practice_state)


def check_request(case_dir: Path, request: PriorAuthRequest | None = None, matcher: str | None = None,
                  votes: int = 2, progress=None) -> PriorAuthCheck:
    case_dir = Path(case_dir)
    scenario = Scenario.load(case_dir)
    req = request or request_from_scenario(scenario)
    tracker = CostTracker()
    say = progress or (lambda msg: None)

    say("Finding the policy in effect on the planned date")
    policy = resolve_policy(req.plan_type, req.payer_name, req.planned_dos, req.practice_state)
    say("Splitting the policy into rules (Nemotron 3 Super picks sentences)")
    criteria = extract_criteria(policy, tracker=tracker)
    notes = load_notes(case_dir)
    say("Extracting chart facts with verified quotes (Nemotron 3 Nano)")
    facts = extract_facts(notes, req.planned_dos, tracker=tracker)
    say(f"Checking {len(criteria)} rules against the chart")
    matches = match_all(criteria, notes, facts, req.planned_dos, tracker=tracker, cpt=req.cpt, votes=votes,
                        **({"model": matcher} if matcher else {}))
    view = facts_view(facts, notes)
    check = PriorAuthCheck(case_id=scenario.case_id, request=req, policy=policy, criteria=criteria,
                           matches=matches, facts=view, readiness="doesnt_qualify")
    decide(check, scenario.patient_name)
    check.trace = tracker.steps
    say(f"Done: {check.readiness.replace('_', ' ')} · ${check.cost_usd:.4f}")
    return check


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("case_dir")
    ap.add_argument("--json", help="write the check as JSON here")
    args = ap.parse_args()
    check = check_request(Path(args.case_dir))
    r = check.request
    print(f"{check.case_id}  {r.payer_name}  CPT {r.cpt}  planned {r.planned_dos}  policy {check.policy.citation()}")
    by_id = {c.criterion_id: c for c in check.criteria}
    for m in check.matches:
        if m.status != "not_applicable":
            print(f"  {m.status:22} {by_id[m.criterion_id].summary}")
    print(f"READINESS: {check.readiness}" + (f"  earliest {check.earliest}" if check.earliest else ""))
    for b in check.earliest_basis:
        print(f"  {b}")
    if check.doc_request:
        print("\n" + check.doc_request)
    print(f"Cost: ${check.cost_usd:.4f}")
    if args.json:
        Path(args.json).write_text(check.model_dump_json(indent=1))


if __name__ == "__main__":
    main()
