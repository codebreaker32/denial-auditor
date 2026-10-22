"""Check each policy criterion against the chart, then decide the verdict in code.

Nano judges one criterion at a time, given the criterion's verbatim policy text,
the code-computed facts and the notes, and quotes its chart evidence. Code
verifies every evidence quote; a "met" with no verified evidence is downgraded
to "missing_documentation". The final verdict is a fixed rule over the
statuses, so no model makes the appeal / don't-appeal call.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from nebius_nvidia.facts import ChartFacts, Quoted, notes_block, verify_quote
from nebius_nvidia.llm import SUPER, structured
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

Documentation rules only require what this patient's applicable route needs (e.g. with red flags, no conservative treatment needs to be documented).
Use the computed facts for durations; don't do date arithmetic yourself.
Quote chart evidence exactly, one sentence per item, with its note_id. Give a one-sentence rationale a billing specialist can read."""


class EvidenceDraft(Quoted):
    pass


class MatchDraft(BaseModel):
    status: Literal["met", "not_met", "missing_documentation", "not_applicable"]
    evidence: list[EvidenceDraft] = Field(default_factory=list)
    rationale: str


def match_one(criterion: Criterion, notes: list[ChartNote], facts: ChartFacts, dos: date, model: str = SUPER,
              tracker=None, cpt: str | None = None) -> CriterionMatch:
    if criterion.kind == "red_flag" and not facts.draft.red_flags:
        # Decided in code: with no verified red flags, a red-flag route is not relevant.
        return CriterionMatch(criterion_id=criterion.criterion_id, status="not_applicable", evidence=[],
                              rationale="No red flags are documented, so this red-flag route doesn't apply; the conservative-care route is checked instead.",
                              model="rule")
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
        step=f"match:{criterion.criterion_id}",
        tracker=tracker,
    )
    evidence = [verify_quote(e, notes) for e in draft.evidence]
    status = draft.status
    if status == "met" and not any(e.verified for e in evidence):
        status = "missing_documentation"
    status = adjust(criterion.kind, status)
    rationale = draft.rationale
    return CriterionMatch(
        criterion_id=criterion.criterion_id,
        status=status,
        evidence=evidence,
        rationale=rationale,
        model=model,
    )


def match_all(criteria: list[Criterion], notes: list[ChartNote], facts: ChartFacts, dos: date,
              model: str = SUPER, tracker=None, workers: int = 4, cpt: str | None = None) -> list[CriterionMatch]:
    with ThreadPoolExecutor(workers) as pool:
        return list(pool.map(lambda c: match_one(c, notes, facts, dos, model, tracker, cpt), criteria))


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
      any rule missing documentation → ask the physician;
      some route met → appeal; a route clearly not met → don't appeal; otherwise ask.
    """
    if triage.route == "fix_checklist":
        return "fix_checklist"
    if triage.route == "not_winnable":
        return "not_winnable"
    kind = {c.criterion_id: c.kind for c in criteria or []}
    if any(m.status == "not_met" and kind.get(m.criterion_id) != "indication" for m in matches):
        return "dont_appeal"
    if any(m.status == "missing_documentation" for m in matches):
        return "doc_request"
    if any(m.status == "met" and kind.get(m.criterion_id, "indication") in ROUTE_KINDS for m in matches):
        return "appeal"
    if any(m.status == "not_met" for m in matches):
        return "dont_appeal"
    return "doc_request"
