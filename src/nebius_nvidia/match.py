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
from nebius_nvidia.llm import NANO, structured
from nebius_nvidia.models import ChartNote, Criterion, CriterionMatch, TriageResult, Verdict

SYSTEM = """You check ONE coverage criterion from a payer policy against a patient's chart, for a medical-billing team.

Decide the status:
- not_applicable: the criterion doesn't apply to this patient. Examples: a rule for patients WITHOUT red flags when red flags are present; a rule for patients WITH red flags when none are present; a limitation or exclusion that doesn't describe this case (an investigational use that wasn't ordered, a repeat-MRI rule when there is no prior MRI, a duplicate-imaging rule when there was no other imaging).
- met: the criterion applies and the chart affirmatively shows it is satisfied, with evidence. For a limitation that applies (e.g. findings must affect treatment), met means the chart shows the case satisfies it.
- not_met: the criterion applies and the chart shows it is NOT satisfied (e.g. too short a trial of conservative care, or the case falls under an exclusion).
- missing_documentation: the criterion applies but the chart doesn't document whether it is satisfied.

Use the computed facts for durations; don't do date arithmetic yourself.
Quote chart evidence exactly, one sentence per item, with its note_id. Give a one-sentence rationale a billing specialist can read."""


class EvidenceDraft(Quoted):
    pass


class MatchDraft(BaseModel):
    status: Literal["met", "not_met", "missing_documentation", "not_applicable"]
    evidence: list[EvidenceDraft] = Field(default_factory=list)
    rationale: str


def match_one(criterion: Criterion, notes: list[ChartNote], facts: ChartFacts, dos: date, model: str = NANO, tracker=None) -> CriterionMatch:
    prompt = (
        f"CRITERION ({criterion.kind}; applies when: {criterion.applies_when or 'always'}):\n"
        f"<policy_text>{criterion.verbatim_span}</policy_text>\n\n"
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
    return CriterionMatch(
        criterion_id=criterion.criterion_id,
        status=status,
        evidence=evidence,
        rationale=draft.rationale,
        model=model,
    )


def match_all(criteria: list[Criterion], notes: list[ChartNote], facts: ChartFacts, dos: date,
              model: str = NANO, tracker=None, workers: int = 4) -> list[CriterionMatch]:
    with ThreadPoolExecutor(workers) as pool:
        return list(pool.map(lambda c: match_one(c, notes, facts, dos, model, tracker), criteria))


def verdict(triage: TriageResult, matches: list[CriterionMatch]) -> Verdict:
    """Fixed rule: administrative → fix it; exclusion → not winnable; otherwise
    any unmet criterion → don't appeal; any undocumented one → ask the physician; else appeal."""
    if triage.route == "fix_checklist":
        return "fix_checklist"
    if triage.route == "not_winnable":
        return "not_winnable"
    statuses = {m.status for m in matches}
    if "not_met" in statuses:
        return "dont_appeal"
    if "missing_documentation" in statuses or "met" not in statuses:
        return "doc_request"
    return "appeal"
