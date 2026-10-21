"""Route a denial: administrative fix, plan exclusion (not winnable), or clinical review.

Claim adjustment reason codes (CARC) decide the route through a fixed table, so
the common cases never touch an LLM. Labels and checklists are our own
plain-English wording (the official X12 code descriptions are not reproduced).
Nano classifies only when the notice carries no recognised code.
"""

from typing import Literal

from pydantic import BaseModel

from nebius_nvidia.llm import NANO, structured
from nebius_nvidia.models import Denial, TriageResult

ReasonClass = Literal["administrative", "plan_exclusion", "clinical"]

# code → (class, our label, fix checklist)
CARC_TABLE: dict[str, tuple[ReasonClass, str, list[str]]] = {
    "50": ("clinical", "Medical necessity", []),
    "55": ("clinical", "Considered experimental or investigational", []),
    "16": ("administrative", "Missing or incorrect claim information", [
        "Find the missing or incorrect field named in the remark codes or notice.",
        "Correct it (e.g. referring provider NPI) and submit a corrected claim.",
        "No clinical appeal needed.",
    ]),
    "27": ("administrative", "Coverage not active on the date of service", [
        "Re-verify eligibility for the date of service.",
        "If another plan was active, bill that payer; otherwise bill the patient per policy.",
    ]),
    "29": ("administrative", "Filed after the filing deadline", [
        "Locate proof of timely filing (clearinghouse acceptance report).",
        "Appeal only with that proof attached; otherwise the claim is not recoverable.",
    ]),
    "197": ("administrative", "Prior authorization missing", [
        "Check whether an authorization exists under another number or provider.",
        "If none, ask the payer about retro-authorization before appealing on medical necessity.",
    ]),
    "96": ("plan_exclusion", "Service excluded or not covered by the plan", []),
    "204": ("plan_exclusion", "Not covered under the member's benefit plan", []),
}

ROUTE = {"administrative": "fix_checklist", "plan_exclusion": "not_winnable", "clinical": "clinical_review"}
NOT_WINNABLE_NOTE = (
    "The plan excludes this service, so medical-necessity evidence won't change the outcome. "
    "Explain the exclusion to the patient and check whether another payer or a covered alternative applies."
)


class TriageDraft(BaseModel):
    reason_class: ReasonClass
    explanation: str


def triage(denial: Denial, tracker=None) -> TriageResult:
    known = [CARC_TABLE[c] for c in denial.carc if c in CARC_TABLE]
    if known:
        # The most actionable class wins: an administrative defect must be fixed first,
        # and an exclusion makes clinical evidence moot.
        order = {"administrative": 0, "plan_exclusion": 1, "clinical": 2}
        cls, label, checklist = min(known, key=lambda k: order[k[0]])
        return TriageResult(
            reason_class=cls,
            route=ROUTE[cls],
            method="carc_table",
            checklist=checklist,
            explanation=label if cls != "plan_exclusion" else f"{label}. {NOT_WINNABLE_NOTE}",
        )

    draft = structured(
        NANO,
        [
            {"role": "system", "content": (
                "Classify a health-insurance denial reason for a billing team. administrative = claim data, eligibility, "
                "filing or authorization paperwork problems; plan_exclusion = the plan does not cover this service at all; "
                "clinical = the payer says the service was not medically necessary or criteria were not met."
            )},
            {"role": "user", "content": f"Denial reason: {denial.reason_text}"},
        ],
        TriageDraft,
        max_tokens=2048,
        step="triage",
        tracker=tracker,
        thinking=False,
    )
    return TriageResult(
        reason_class=draft.reason_class,
        route=ROUTE[draft.reason_class],
        method="llm",
        checklist=[],
        explanation=draft.explanation,
    )
