"""Shared data models for the Denial Auditor pipeline.

Pydantic models so every LLM step can validate structured output against them
(and publish their JSON schema in prompts / response_format).

Text-integrity rule: any field named `text`, `verbatim_span` or `quote` holds
characters copied from a fetched source or a chart note. Code verifies them
with text.locate(); models never supply offsets we trust.
"""

import hashlib
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, computed_field

PlanType = Literal["MA", "MEDICARE_FFS", "COMMERCIAL_ACA", "COMMERCIAL_ERISA", "MEDICAID", "UNKNOWN"]


# --- Policies ----------------------------------------------------------------


class PolicyDoc(BaseModel):
    """One version of a payer coverage policy, exactly as fetched."""

    source: Literal["cms-lcd", "aetna-cpb", "ma-plan"]
    policy_id: str  # "L34220", "CPB 0236"
    version: str  # "40" for CMS; fetch date for snapshot sources
    title: str
    effective_from: date | None
    effective_to: date | None  # None = still in effect
    retired: bool = False
    version_basis: Literal["api-versioned", "snapshot-at-fetch"]
    url: str
    fetched_at: datetime
    fetched_via: Literal["cms-api", "tavily-extract", "http"]
    text: str  # plain text, verbatim; never edit after fetch

    @computed_field
    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.text.encode()).hexdigest()

    def in_effect_on(self, dos: date) -> bool:
        if self.effective_from is None:
            return False
        return self.effective_from <= dos and (self.effective_to is None or dos <= self.effective_to)

    def citation(self) -> str:
        """Short human citation, e.g. 'L34220 v40, eff 10/23/2025, CMS Coverage API'."""
        eff = self.effective_from.strftime("%m/%d/%Y") if self.effective_from else "date unknown"
        via = {"cms-api": "CMS Coverage API", "tavily-extract": "fetched via Tavily", "http": "from the payer's site"}
        ver = f"v{self.version}" if self.version_basis == "api-versioned" else f"snapshot {self.version}"
        return f"{self.policy_id} {ver}, eff {eff}, {via[self.fetched_via]}"


class Criterion(BaseModel):
    criterion_id: str  # "C1", "C2", ...
    doc_id: str  # PolicyDoc.policy_id + version
    summary: str  # our paraphrase, for display only; never quoted
    verbatim_span: str  # exact sentence(s) from the policy text
    kind: Literal["indication", "red_flag", "duration", "documentation", "exclusion"]
    applies_when: str | None = None  # e.g. "no red flags present"
    span_start: int | None = None  # set by code, never by the model
    span_end: int | None = None
    span_verified: bool = False


# --- Chart and denial --------------------------------------------------------


class ChartNote(BaseModel):
    note_id: str
    date: date
    note_type: Literal["initial_visit", "pt_note", "follow_up", "imaging_order", "imaging_report", "other"]
    author_role: str
    text: str  # synthetic; must start with the SYNTHETIC banner


class Evidence(BaseModel):
    note_id: str
    quote: str
    start: int | None = None
    end: int | None = None
    verified: bool = False


class CriterionMatch(BaseModel):
    criterion_id: str
    status: Literal["met", "not_met", "missing_documentation", "not_applicable"]
    evidence: list[Evidence] = Field(default_factory=list)
    rationale: str
    model: str = ""
    # Independent judgments behind the status, e.g. ["super:met", "super:met"].
    votes: list[str] = Field(default_factory=list)
    # agreed: both votes matched; escalated: they split and Ultra decided;
    # single: one vote; rule: decided in code, no model.
    confidence: Literal["agreed", "escalated", "single", "rule"] = "single"


class TreatmentSpan(BaseModel):
    kind: str
    start: date | None
    end: date | None
    sessions: int | None = None
    response: str | None = None
    note_id: str | None = None


class FlagMark(BaseModel):
    flag: str
    note_id: str
    noted_on: date | None = None


class FactsView(BaseModel):
    """Chart facts as stored on a case run (verified quotes only), for the UI timeline."""

    onset: date | None = None
    symptom_days: int | None = None
    conservative_days: int | None = None
    treatments: list[TreatmentSpan] = Field(default_factory=list)
    red_flags: list[FlagMark] = Field(default_factory=list)
    neuro_exam: str | None = None
    radiculopathy: str | None = None
    plan_after_mri: str | None = None


class Denial(BaseModel):
    payer_name: str
    plan_type: PlanType
    cpt: str  # bare 5-digit code only (no AMA descriptor)
    icd10: list[str]
    dos: date
    notice_date: date
    carc: list[str] = Field(default_factory=list)  # claim adjustment reason codes, bare
    reason_text: str
    practice_state: str | None = None
    extracted_by: str = ""


class TriageResult(BaseModel):
    reason_class: Literal["administrative", "plan_exclusion", "clinical"]
    route: Literal["fix_checklist", "not_winnable", "clinical_review"]
    method: Literal["carc_table", "llm"]
    checklist: list[str] = Field(default_factory=list)
    explanation: str = ""


# --- Appeal and gate ---------------------------------------------------------


class Quote(BaseModel):
    qid: str
    text: str
    source_kind: Literal["policy", "chart"]
    source_id: str  # PolicyDoc doc id or ChartNote.note_id
    citation: str


class Section(BaseModel):
    heading: str
    body: str  # prose with {{Q:qid}} markers where verified quotes go


class CritiqueItem(BaseModel):
    issue: str
    severity: Literal["major", "minor"]
    suggestion: str


class AppealDraft(BaseModel):
    sections: list[Section]
    critique: list[CritiqueItem] = Field(default_factory=list)
    revision: int = 0
    rendered: str = ""  # filled by appeal.render()


class QuoteCheck(BaseModel):
    text: str
    status: Literal["verified", "not_found"]
    source_id: str | None = None


class GateResult(BaseModel):
    ok: bool
    checks: list[QuoteCheck]
    reason: str = ""


class Deadline(BaseModel):
    rule_id: str
    due: date | None
    days_left: int | None
    basis: str  # human explanation, e.g. "65 days from the notice date"
    citation: str
    source_url: str
    verified: bool  # False → UI shows "Deadline unverified"


# --- Run trace ---------------------------------------------------------------


class StepTrace(BaseModel):
    step: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    latency_s: float = 0.0
    attempts: int = 1


Verdict = Literal["appeal", "doc_request", "dont_appeal", "fix_checklist", "not_winnable"]


class CaseRun(BaseModel):
    case_id: str
    denial: Denial
    triage: TriageResult
    policy: PolicyDoc | None = None
    criteria: list[Criterion] = Field(default_factory=list)
    matches: list[CriterionMatch] = Field(default_factory=list)
    verdict: Verdict
    appeal: AppealDraft | None = None
    doc_request: str | None = None
    gate: GateResult | None = None
    deadline: Deadline | None = None
    facts: FactsView | None = None
    trace: list[StepTrace] = Field(default_factory=list)

    @computed_field
    @property
    def cost_usd(self) -> float:
        return round(sum(t.cost_usd for t in self.trace), 6)


# --- Prevention (prior-auth check before submission) -------------------------

Readiness = Literal["ready", "add_documentation", "not_yet", "doesnt_qualify"]


class PriorAuthRequest(BaseModel):
    payer_name: str
    plan_type: PlanType
    cpt: str  # bare code only
    icd10: list[str]
    planned_dos: date
    practice_state: str | None = None


class PriorAuthCheck(BaseModel):
    case_id: str
    request: PriorAuthRequest
    policy: PolicyDoc | None = None
    criteria: list[Criterion] = Field(default_factory=list)
    matches: list[CriterionMatch] = Field(default_factory=list)
    facts: FactsView | None = None
    readiness: Readiness
    earliest: date | None = None  # computed in code from the chart dates and the policy's waiting periods
    earliest_basis: list[str] = Field(default_factory=list)
    doc_request: str | None = None
    trace: list[StepTrace] = Field(default_factory=list)

    @computed_field
    @property
    def cost_usd(self) -> float:
        return round(sum(t.cost_usd for t in self.trace), 6)
