"""Check each policy criterion against the chart, then decide the verdict in code.

Nano judges one criterion at a time, given the criterion's verbatim policy text,
the code-computed facts and the notes, and quotes its chart evidence. Code
verifies every evidence quote; a "met" with no verified evidence is downgraded
to "missing_documentation". The final verdict is a fixed rule over the
statuses, so no model makes the appeal / don't-appeal call.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from nebius_nvidia.facts import ChartFacts, Quoted, notes_block, verify_quote
from nebius_nvidia.llm import SUPER, ULTRA, structured
from nebius_nvidia.models import ChartNote, Criterion, CriterionMatch, TriageResult, Verdict

# Our own plain labels for the ordered study (not the AMA CPT descriptors).
STUDY_LABELS = {
    "72148": "lumbar spine MRI without contrast",
    "72149": "lumbar spine MRI with contrast",
    "72158": "lumbar spine MRI without and then with contrast",
}

SYSTEM = """You check ONE rule from a payer coverage policy against a patient's chart, for a medical-billing team deciding whether to appeal a denied lumbar MRI.

Policies give alternative routes to coverage (e.g. red flags OR a failed trial of conservative care) plus restrictions. Decide this rule's EFFECT on coverage for this patient:
- met: the rule SUPPORTS coverage here. The chart affirmatively shows the patient qualifies under it, with evidence.
- not_met: the rule BLOCKS coverage here. It's a requirement this patient clearly fails (e.g. too short a trial of conservative care with no red flags), or a restriction whose condition this case falls under.
- not_applicable: the rule is NOT RELEVANT to this patient. Examples: a red-flag route when the patient has no red flags (absence of red flags never blocks coverage by itself; the conservative-care route may apply instead); a no-red-flag route when red flags are present; a restriction whose condition doesn't describe this case (the first-month limit when symptoms are past one month or a red flag is present; "findings won't affect treatment" when the chart says they will; an exclusion for uncomplicated disease when surgery or injection is being considered; a duplicate- or repeat-imaging rule when there was no other imaging; an investigational use that wasn't ordered; contrast rules for a study without contrast).
- missing_documentation: the rule matters here but the chart doesn't show whether it's satisfied.

Read each rule literally, as the payer's medical reviewer would: it is met only when the chart states the specific finding the rule names. "Progressively severe" needs documented worsening, not just persistence; "major motor weakness" needs weakness described as major or severe, not mild (e.g. 4/5); a diagnosis-specific route needs that diagnosis documented. Never stretch a rule to fit; when the chart is borderline, use missing_documentation.
Documentation rules only require what this patient's applicable route needs (e.g. with red flags, no conservative treatment needs to be documented).
Use the computed facts for durations; don't do date arithmetic yourself.
Quote chart evidence exactly, one sentence per item, with its note_id. Give a one-sentence rationale a billing specialist can read."""


class EvidenceDraft(Quoted):
    pass


class MatchDraft(BaseModel):
    status: Literal["met", "not_met", "missing_documentation", "not_applicable"]
    evidence: list[EvidenceDraft] = Field(default_factory=list)
    rationale: str


def _judge(criterion: Criterion, notes: list[ChartNote], facts: ChartFacts, dos: date, model: str,
           tracker, cpt: str | None, step: str) -> tuple[str, list, str]:
    """One model judgment of one rule, with the code rules applied on top."""
    prompt = (
        f"RULE ({criterion.kind}; applies when: {criterion.applies_when or 'always'}):\n"
        f"<policy_text>{criterion.verbatim_span}</policy_text>\n\n"
        f"ORDERED STUDY: {STUDY_LABELS.get(cpt or '', 'lumbar spine MRI')} (a single study; no repeat or second study unless the facts say so)\n"
        f"DATE OF SERVICE: {dos}\n\nCOMPUTED FACTS (from verified chart quotes):\n{facts.summary()}\n\n"
        f"CHART NOTES:\n{notes_block(notes)}"
    )
    draft = structured(
        model,
        [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
        MatchDraft,
        max_tokens=4096,
        step=step,
        tracker=tracker,
    )
    evidence = [verify_quote(e, notes) for e in draft.evidence]
    status = draft.status
    if status == "met" and not any(e.verified for e in evidence):
        status = "missing_documentation"
    status = adjust(criterion.kind, status)
    rationale = draft.rationale
    if status in ("not_met", "missing_documentation") and criterion.kind == "duration" and facts.draft.red_flags:
        # Waiting periods (first month, four weeks of conservative care) belong to the
        # no-red-flag route; with verified red flags documented they don't block.
        status = "not_applicable"
        rationale = f"Red flags are documented, so this waiting-period rule doesn't apply. ({rationale})"
    return status, evidence, rationale


def match_one(criterion: Criterion, notes: list[ChartNote], facts: ChartFacts, dos: date, model: str = SUPER,
              tracker=None, cpt: str | None = None, votes: int = 2, referee: str = ULTRA) -> CriterionMatch:
    """Judge one rule. With votes=2, two independent judgments by `model`; if they
    disagree, `referee` (Ultra) decides and the match is marked escalated."""
    cid = criterion.criterion_id
    if criterion.kind == "red_flag" and not facts.draft.red_flags:
        # Decided in code: with no verified red flags, a red-flag route is not relevant.
        return CriterionMatch(criterion_id=cid, status="not_applicable", evidence=[],
                              rationale="No red flags are documented, so this red-flag route doesn't apply; the conservative-care route is checked instead.",
                              model="rule", confidence="rule")
    short = lambda m: "ultra" if m == ULTRA else "super" if m == SUPER else m.split("/")[-1].lower()
    results = [_judge(criterion, notes, facts, dos, model, tracker, cpt, f"match:{cid}:v{i + 1}") for i in range(max(1, votes))]
    ballot = [f"{short(model)}:{r[0]}" for r in results]
    if votes < 2:
        status, evidence, rationale = results[0]
        return CriterionMatch(criterion_id=cid, status=status, evidence=evidence, rationale=rationale,
                              model=model, votes=ballot, confidence="single")
    if len({r[0] for r in results}) == 1:
        # Agreed: keep the vote with the most verified evidence.
        status, evidence, rationale = max(results, key=lambda r: sum(e.verified for e in r[1]))
        return CriterionMatch(criterion_id=cid, status=status, evidence=evidence, rationale=rationale,
                              model=model, votes=ballot, confidence="agreed")
    status, evidence, rationale = _judge(criterion, notes, facts, dos, referee, tracker, cpt, f"match:{cid}:referee")
    return CriterionMatch(criterion_id=cid, status=status, evidence=evidence, rationale=rationale,
                          model=referee, votes=ballot + [f"{short(referee)}:{status}"], confidence="escalated")


def match_all(criteria: list[Criterion], notes: list[ChartNote], facts: ChartFacts, dos: date,
              model: str = SUPER, tracker=None, workers: int = 4, cpt: str | None = None, votes: int = 2,
              on_done=None) -> list[CriterionMatch]:
    """Judge every rule in parallel. Returns matches in criteria order; `on_done(criterion, match)`,
    if given, is called (on the calling thread) as each rule finishes, in completion order."""
    with ThreadPoolExecutor(workers) as pool:
        futures = {pool.submit(match_one, c, notes, facts, dos, model, tracker, cpt, votes): i
                   for i, c in enumerate(criteria)}
        out: list[CriterionMatch | None] = [None] * len(criteria)
        for fut in as_completed(futures):
            i = futures[fut]
            out[i] = fut.result()
            if on_done:
                on_done(criteria[i], out[i])
    return out  # type: ignore[return-value]


ROUTE_KINDS = {"indication", "red_flag", "duration"}


def adjust(kind: str, status: str) -> str:
    """Code rules applied on top of the model's status.

    - A documentation rule can only be satisfied by adding records, so it is never not_met.
    - A restriction (exclusion) bites only with evidence the case falls under it, so an
      undocumented one is not_applicable rather than missing documentation.
    """
    if kind == "documentation" and status == "not_met":
        return "missing_documentation"
    if kind == "exclusion" and status == "missing_documentation":
        return "not_applicable"
    return status


def verdict(triage: TriageResult, matches: list[CriterionMatch], criteria: list[Criterion] | None = None) -> Verdict:
    """Fixed rule over the statuses (no model decides this).

    Indications are alternative routes to coverage: an unmet indication only matters
    when no route is met. Any other unmet rule blocks.
      administrative → fix it; exclusion → not winnable;
      a non-indication rule not met → don't appeal;
      some route met → appeal, or ask the physician if anything is undocumented;
      no route met and one clearly fails → don't appeal yet; otherwise ask.
    """
    if triage.route == "fix_checklist":
        return "fix_checklist"
    if triage.route == "not_winnable":
        return "not_winnable"
    return clinical_verdict(matches, criteria)


def clinical_verdict(matches: list[CriterionMatch], criteria: list[Criterion] | None = None) -> Verdict:
    """The clinical part of verdict(); prevention mode uses it on a request that hasn't been denied."""
    kind = {c.criterion_id: c.kind for c in criteria or []}
    if any(m.status == "not_met" and kind.get(m.criterion_id) != "indication" for m in matches):
        return "dont_appeal"
    route_met = any(m.status == "met" and kind.get(m.criterion_id, "indication") in ROUTE_KINDS for m in matches)
    # An undocumented *route* is just an unused alternative, not a reason to chase the physician.
    missing = any(m.status == "missing_documentation" and kind.get(m.criterion_id) != "indication" for m in matches)
    if route_met:
        return "doc_request" if missing else "appeal"
    if any(m.status == "not_met" for m in matches):
        # No route qualifies and one clearly fails (e.g. 5 of 6 required weeks): more
        # paperwork won't fix it, so don't appeal yet.
        return "dont_appeal"
    return "doc_request"
