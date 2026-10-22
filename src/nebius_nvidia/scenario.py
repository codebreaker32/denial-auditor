"""Synthetic case scenarios: the ground truth every generated case is built from.

A scenario fixes the denial, the clinical facts the chart must contain, and the
expected outcome. Chart notes and letters are generated FROM it, and the eval
scores the pipeline AGAINST it, so the pipeline never grades its own extraction.

All patients are synthetic. Names come from a fixed list of obviously fictional
placeholders and every document carries the SYNTHETIC banner.
"""

from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from nebius_nvidia.models import PlanType, Verdict

SYNTHETIC_BANNER = "SYNTHETIC – NOT A REAL PATIENT"

# "clear" = a restriction that doesn't bite: either met or not_applicable counts as correct.
GoldStatus = Literal["met", "not_met", "missing_documentation", "not_applicable", "clear"]


class Treatment(BaseModel):
    kind: Literal["physical_therapy", "nsaids", "home_exercise", "chiropractic", "activity_modification"]
    start: date
    end: date
    sessions: int | None = None
    response: Literal["no_improvement", "partial", "improved"] = "no_improvement"

    @property
    def days(self) -> int:
        return (self.end - self.start).days


class Facts(BaseModel):
    age: int
    sex: Literal["F", "M"]
    onset: date
    treatments: list[Treatment] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)  # wording from the L34220 red-flag list
    neuro_exam: Literal["normal", "deficit", "not_documented"] = "normal"
    # Aetna CPB 0236: radiculopathy needs "objective findings of motor or reflex changes".
    radiculopathy: Literal["none", "subjective", "objective"] = "none"
    prior_imaging: list[str] = Field(default_factory=list)  # e.g. "lumbar x-ray 2026-06-20: mild spondylosis"
    plan_after_mri: str | None = None  # how results will change treatment (L34220: findings must affect treatment)
    surgery_or_injection_considered: bool = False


class Expected(BaseModel):
    route: Literal["fix_checklist", "not_winnable", "clinical_review"]
    verdict: Verdict
    gold: dict[str, GoldStatus] = Field(default_factory=dict)  # gold anchor id → status (eval/gold/*.json)
    why: str


class Scenario(BaseModel):
    case_id: str
    group: str
    patient_name: str
    plan_type: PlanType
    payer: str
    practice_state: str
    policy: str  # "L34220" or "AETNA-0236"
    cpt: str = "72148"  # bare code only
    icd10: list[str]
    dos: date
    notice_date: date
    carc: list[str] = Field(default_factory=list)
    reason_text: str
    facts: Facts
    expected: Expected

    def save(self, cases_dir: Path) -> Path:
        d = cases_dir / self.case_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "scenario.json").write_text(self.model_dump_json(indent=1))
        return d

    @classmethod
    def load(cls, case_dir: Path) -> "Scenario":
        return cls.model_validate_json((case_dir / "scenario.json").read_text())
