"""Appeal letters that can't contain a fabricated quote, and documentation requests.

1. build_quote_bank(): every passage the letter may quote, already verified:
   policy spans of applicable criteria (cut from the fetched policy) and chart
   evidence quotes (located in the notes). Each gets an id (P1.., E1..).
2. Ultra drafts the letter as sections whose prose references quotes ONLY by
   marker, {{Q:P3}}; it never types quoted text and may cite nothing outside
   the bank (no regulations, statistics or literature, which we couldn't verify).
3. Super critiques the draft as the payer's medical reviewer; Ultra revises.
4. render() substitutes the real text as block quotes with citation lines; an
   unknown marker renders as an unverifiable quote, so the gate blocks export.

Documentation requests to the physician are templated (no LLM).
"""

import re

from pydantic import BaseModel, Field

from nebius_nvidia.citations import Session, check
from nebius_nvidia.llm import SUPER, ULTRA, structured
from nebius_nvidia.models import (
    AppealDraft,
    CaseRun,
    ChartNote,
    CritiqueItem,
    GateResult,
    Quote,
    Section,
)

MARKER = re.compile(r"\{\{Q:([A-Z]\d+)\}\}")

DRAFT_SYSTEM = """You write a provider's written request for reconsideration of a denied lumbar MRI claim, on behalf of a small medical practice.
The reader is the payer's medical reviewer. Be factual, specific and brief (under 450 words of prose).

You may quote ONLY from the QUOTE BANK, and only by writing its marker, e.g. {{Q:P2}} or {{Q:E5}}, on its own line where the quote belongs.
Never type quotation marks or copy policy or chart wording yourself; never cite any regulation, statistic, study, guideline or source that is not in the quote bank.

Structure (sections): "Request", "Reason for denial", "Applicable coverage policy" (quote the policy passages that the case meets),
"Clinical evidence" (quote the chart evidence for each), "Response to the denial reason" (explain why the stated reason does not apply, using the policy and chart quotes),
"Requested action". Use the payer and patient details given. Do not invent facts, dates, names or signatures."""

CRITIQUE_SYSTEM = """You are a skeptical medical director at the health plan reviewing a provider's reconsideration request.
List the weaknesses a reviewer would use to uphold the denial: unsupported claims, a criterion asserted without chart evidence, ignoring the stated denial reason,
overstatement, missing facts, wrong policy logic. Be concrete. Return at most 5 items. If the letter is strong, return fewer."""

REVISE_SYSTEM = DRAFT_SYSTEM + """

You are revising your draft to address the reviewer's critique. Fix every major issue you can with the quote bank and facts given; never add unsupported claims."""


class SectionDraft(BaseModel):
    heading: str
    body: str


class DraftOut(BaseModel):
    sections: list[SectionDraft] = Field(min_length=3)


class CritiqueOut(BaseModel):
    items: list[CritiqueItem] = Field(default_factory=list, max_length=5)


def build_quote_bank(run: CaseRun, notes: list[ChartNote]) -> list[Quote]:
    bank: list[Quote] = []
    by_crit = {c.criterion_id: c for c in run.criteria}
    note_by_id = {n.note_id: n for n in notes}
    seen: set[str] = set()
    for m in run.matches:
        if m.status != "met":
            continue
        c = by_crit[m.criterion_id]
        if c.span_verified and c.verbatim_span not in seen:
            seen.add(c.verbatim_span)
            bank.append(Quote(qid=f"P{len(bank) + 1}", text=c.verbatim_span, source_kind="policy",
                              source_id=c.doc_id, citation=run.policy.citation() if run.policy else c.doc_id))
    n = 0
    for m in run.matches:
        if m.status != "met":
            continue
        for e in m.evidence:
            if e.verified and e.quote not in seen:
                seen.add(e.quote)
                n += 1
                note = note_by_id.get(e.note_id)
                when = f"{note.date:%m/%d/%Y} {note.note_type.replace('_', ' ')}" if note else e.note_id
                bank.append(Quote(qid=f"E{n}", text=e.quote, source_kind="chart", source_id=e.note_id,
                                  citation=f"Chart note, {when}"))
    return bank


def _bank_block(bank: list[Quote]) -> str:
    return "\n".join(f"[{q.qid}] ({q.source_kind}; {q.citation}) {q.text}" for q in bank)


def _context(run: CaseRun, patient_name: str) -> str:
    d = run.denial
    return (
        f"Payer: {d.payer_name} ({d.plan_type}). Patient: {patient_name}. Service: lumbar spine MRI, CPT {d.cpt}. "
        f"Date of service: {d.dos:%m/%d/%Y}. Notice date: {d.notice_date:%m/%d/%Y}. Reason codes: {', '.join(d.carc) or 'none'}.\n"
        f"Denial reason as stated: {d.reason_text}\n"
        f"Policy in effect on the date of service: {run.policy.title}, {run.policy.citation()}."
    )


def render(draft: AppealDraft, bank: list[Quote]) -> str:
    by_id = {q.qid: q for q in bank}

    def sub(m: re.Match) -> str:
        q = by_id.get(m.group(1))
        if not q:
            return f"\n> [unverifiable quote {m.group(1)}]\n"
        body = "\n".join(f"> {line}" if line.strip() else ">" for line in q.text.splitlines())
        return f"\n{body}\n> — {q.citation}\n"

    parts = []
    for s in draft.sections:
        # Quotation marks the model typed itself are left in place on purpose: the gate
        # then treats them as quotes and blocks export unless they match a source.
        body = MARKER.sub(sub, s.body)
        parts.append(f"## {s.heading}\n\n{body.strip()}")
    return "\n\n".join(parts)


def session_for(run: CaseRun, notes: list[ChartNote]) -> Session:
    s = Session()
    if run.policy:
        s.add(f"{run.policy.policy_id}v{run.policy.version}", run.policy.text)
    for n in notes:
        s.add(n.note_id, n.text)
    return s


def draft_appeal(run: CaseRun, notes: list[ChartNote], patient_name: str, tracker=None,
                 drafter: str = ULTRA, critic: str = SUPER, revise: bool = True) -> tuple[AppealDraft, list[Quote], GateResult]:
    bank = build_quote_bank(run, notes)
    user = f"{_context(run, patient_name)}\n\nQUOTE BANK:\n{_bank_block(bank)}"
    first = structured(drafter, [{"role": "system", "content": DRAFT_SYSTEM}, {"role": "user", "content": user}],
                       DraftOut, max_tokens=8192, step="appeal_draft", tracker=tracker)
    draft = AppealDraft(sections=[Section(**s.model_dump()) for s in first.sections])
    draft.rendered = render(draft, bank)

    if revise:
        crit = structured(critic, [{"role": "system", "content": CRITIQUE_SYSTEM},
                                   {"role": "user", "content": f"{_context(run, patient_name)}\n\nLETTER:\n{draft.rendered}"}],
                          CritiqueOut, max_tokens=4096, step="appeal_critique", tracker=tracker)
        if crit.items:
            critique = "\n".join(f"- [{c.severity}] {c.issue} → {c.suggestion}" for c in crit.items)
            second = structured(drafter, [{"role": "system", "content": REVISE_SYSTEM},
                                          {"role": "user", "content": f"{user}\n\nYOUR DRAFT:\n{first.model_dump_json()}\n\nREVIEWER CRITIQUE:\n{critique}"}],
                                DraftOut, max_tokens=8192, step="appeal_revise", tracker=tracker)
            draft = AppealDraft(sections=[Section(**s.model_dump()) for s in second.sections], critique=crit.items, revision=1)
            draft.rendered = render(draft, bank)

    gate = check(draft.rendered, session_for(run, notes))
    return draft, bank, gate


def documentation_request(run: CaseRun, patient_name: str) -> str | None:
    """Templated request to the physician for each criterion the chart doesn't document."""
    return gap_request(run.criteria, run.matches, patient_name, run.denial.dos, run.denial.payer_name, run.policy,
                       "The claim was denied. Before we appeal, please check the chart for the items below "
                       "and add an addendum if they were done:")


def gap_request(criteria, matches, patient_name: str, dos, payer_name: str, policy, ask: str) -> str | None:
    by_crit = {c.criterion_id: c for c in criteria}
    gaps = [by_crit[m.criterion_id] for m in matches if m.status == "missing_documentation"]
    if not gaps:
        return None
    lines = [
        f"Documentation request: {patient_name} (synthetic), lumbar MRI, date of service {dos:%m/%d/%Y}",
        f"Payer: {payer_name}. Policy in effect: {policy.citation() if policy else 'n/a'}.",
        "",
        ask,
        "",
    ]
    for i, c in enumerate(gaps, 1):
        lines += [f"{i}. {c.summary}", f"   Policy wording: \"{c.verbatim_span}\"", ""]
    lines.append("Please don't add anything that didn't happen; only document care that was actually provided.")
    return "\n".join(lines)
