"""Chart notes → structured clinical facts, each backed by a verified quote.

Nano extracts the facts with the sentence that states each one; code verifies
every quote against the notes (text.locate) and computes durations from the
dates. Model arithmetic is never used: "conservative care: 56 days" comes from
date subtraction here.
"""

from datetime import date as Date

from pydantic import BaseModel, Field

from nebius_nvidia.llm import NANO, structured
from nebius_nvidia.models import ChartNote, Evidence
from nebius_nvidia.text import locate

SYSTEM = """You extract clinical facts from outpatient chart notes for a medical-billing review of a lumbar MRI.

For every fact, quote the ONE sentence from the notes that states it, copied exactly, with its note_id.
- onset: when the low back pain began.
- treatments: each conservative treatment (physical therapy, NSAIDs/medication, home exercise, chiropractic, activity modification) with start date, end date, number of sessions and response, quoting the sentence that gives the dates. One entry per treatment; use the most complete statement.
- red_flags: only red-flag conditions that are PRESENT, however they are worded. Examples: history of cancer; fever or chills; saddle anesthesia; new bladder dysfunction; major trauma; minor trauma such as a fall in a patient with osteoporosis or osteopenia; unexplained weight loss; IV or injection drug use; immune suppression (e.g. steroids, transplant); recent bacterial infection; pain worse at night or lying down; progressive neurologic deficit or motor weakness. Never list a denied or absent condition.
- neuro_exam: the lower-extremity neurologic exam result: normal, abnormal, or not_documented.
- radiculopathy: none, subjective (radiating pain only) or objective (motor or reflex findings in a nerve-root distribution).
- prior_imaging: lumbar imaging done before this MRI order (x-ray, CT, MRI); [] if the notes say none.
- plan_after_mri: how the MRI result will change treatment, if stated.
Dates as YYYY-MM-DD. Use null when the notes don't say."""


class Quoted(BaseModel):
    note_id: str
    quote: str


class OnsetFact(Quoted):
    date: Date | None


class TreatmentFact(Quoted):
    kind: str
    start: Date | None
    end: Date | None
    sessions: int | None = None
    response: str | None = None


class RedFlagFact(Quoted):
    flag: str


class NeuroFact(Quoted):
    finding: str  # normal | abnormal | not_documented


class RadiculopathyFact(Quoted):
    finding: str  # none | subjective | objective


class ImagingFact(Quoted):
    study: str
    date: Date | None = None


class PlanFact(Quoted):
    text: str


class FactsDraft(BaseModel):
    onset: OnsetFact | None = None
    treatments: list[TreatmentFact] = Field(default_factory=list)
    red_flags: list[RedFlagFact] = Field(default_factory=list)
    neuro_exam: NeuroFact | None = None
    radiculopathy: RadiculopathyFact | None = None
    prior_imaging: list[ImagingFact] = Field(default_factory=list)
    plan_after_mri: PlanFact | None = None


class ChartFacts(BaseModel):
    draft: FactsDraft
    evidence: dict[str, Evidence]  # fact key → verified quote
    symptom_days: int | None  # onset → date of service
    conservative_days: int | None  # earliest treatment start → latest treatment end
    unverified: list[str]  # fact keys whose quote wasn't found in the notes

    def summary(self) -> str:
        """Code-computed facts for the matcher prompt."""
        d = self.draft
        lines = []
        if self.symptom_days is not None:
            lines.append(f"Symptom duration before the MRI: {self.symptom_days} days ({self.symptom_days / 7:.1f} weeks).")
        if self.conservative_days is not None:
            kinds = ", ".join(sorted({t.kind for t in d.treatments}))
            lines.append(f"Conservative treatment ({kinds}): {self.conservative_days} days ({self.conservative_days / 7:.1f} weeks).")
        else:
            lines.append("Conservative treatment: none documented.")
        lines.append("Red flags present: " + (", ".join(r.flag for r in d.red_flags) or "none documented") + ".")
        if d.neuro_exam:
            lines.append(f"Neurologic exam: {d.neuro_exam.finding}.")
        if d.radiculopathy:
            lines.append(f"Radiculopathy: {d.radiculopathy.finding}.")
        lines.append("Prior lumbar imaging: " + (", ".join(i.study for i in d.prior_imaging) or "none documented") + ".")
        if d.plan_after_mri:
            lines.append(f"Plan depending on MRI: {d.plan_after_mri.text}")
        return "\n".join(lines)


def notes_block(notes: list[ChartNote]) -> str:
    return "\n\n".join(f'<note id="{n.note_id}" date="{n.date}" type="{n.note_type}">\n{n.text}\n</note>' for n in notes)


def verify_quote(q: Quoted, notes: list[ChartNote]) -> Evidence:
    """Find the quote in its note (or, failing that, any note); offsets are into that note's text."""
    ordered = sorted(notes, key=lambda n: n.note_id != q.note_id)
    for n in ordered:
        hit = locate(q.quote, n.text)
        if hit:
            return Evidence(note_id=n.note_id, quote=n.text[hit[0] : hit[1]], start=hit[0], end=hit[1], verified=True)
    return Evidence(note_id=q.note_id, quote=q.quote, verified=False)


def extract_facts(notes: list[ChartNote], dos: Date, tracker=None) -> ChartFacts:
    draft = structured(
        NANO,
        [{"role": "system", "content": SYSTEM}, {"role": "user", "content": notes_block(notes)}],
        FactsDraft,
        max_tokens=8192,
        step="facts",
        tracker=tracker,
    )
    evidence: dict[str, Evidence] = {}
    items: list[tuple[str, Quoted]] = []
    if draft.onset:
        items.append(("onset", draft.onset))
    items += [(f"treatment_{i}", t) for i, t in enumerate(draft.treatments)]
    items += [(f"red_flag_{i}", r) for i, r in enumerate(draft.red_flags)]
    items += [(k, v) for k, v in (("neuro_exam", draft.neuro_exam), ("radiculopathy", draft.radiculopathy), ("plan_after_mri", draft.plan_after_mri)) if v]
    items += [(f"prior_imaging_{i}", p) for i, p in enumerate(draft.prior_imaging)]
    for key, q in items:
        evidence[key] = verify_quote(q, notes)

    # Facts whose quote can't be found don't count toward durations.
    treatments = [t for i, t in enumerate(draft.treatments) if evidence[f"treatment_{i}"].verified and t.start and t.end]
    onset_ok = draft.onset and draft.onset.date and evidence["onset"].verified
    return ChartFacts(
        draft=draft,
        evidence=evidence,
        symptom_days=(dos - draft.onset.date).days if onset_ok else None,
        conservative_days=(max(t.end for t in treatments) - min(t.start for t in treatments)).days if treatments else None,
        unverified=[k for k, e in evidence.items() if not e.verified],
    )
