#!/usr/bin/env python3
"""Write the 30 synthetic scenarios (ground truth) to cases/case_NNN/scenario.json.

Deterministic (fixed seed). Groups follow docs/plan.md:
  A  MA, all L34220 criteria met                         8  → appeal  (2 with DOS 2025-06-02 → policy v37)
  B  Aetna commercial, radiculopathy at 5 of 6 weeks     5  → dont_appeal (not yet)
  C  MA demanded an X-ray the LCD doesn't require        4  → appeal  (HHS OIG OEI-09-18-00260 pattern)
  D  Red flag, imaging inside the first month           4  → appeal
  E  MA, only ~2 weeks of conservative care             3  → dont_appeal
  F  Administrative denial                               3  → fix_checklist
  G  Plan exclusion                                      3  → not_winnable

Usage: ./.venv/bin/python eval/make_scenarios.py [--out cases]
"""

import argparse
import random
from datetime import date, timedelta
from pathlib import Path

from nebius_nvidia.scenario import Expected, Facts, Scenario, Treatment

rng = random.Random(20261021)

# Obviously fictional placeholder names; every document also carries the SYNTHETIC banner.
NAMES = [
    "Avery Sample", "Jordan Testcase", "Riley Placeholder", "Casey Example", "Morgan Fixture",
    "Quinn Mockdata", "Rowan Synthetic", "Sage Dummy", "Emerson Specimen", "Harper Demo",
    "Parker Prototype", "Reese Template", "Skyler Testpatient", "Taylor Sampleton", "Drew Exemplar",
    "Hayden Mockup", "Jamie Fauxname", "Kendall Pretend", "Logan Notreal", "Marley Standin",
    "Noel Stub", "Oakley Proxy", "Peyton Fictive", "Remy Draftwell", "Shiloh Testwood",
    "Tatum Mockwell", "Val Simulant", "Wren Fakeley", "Arden Specimen", "Blair Testford",
]
MA_PLANS = ["Sunrise Senior Advantage (synthetic MA plan)", "Evergreen Medicare Advantage (synthetic)", "Harbor Health MA (synthetic)"]
NORIDIAN_STATES = ["CA", "WA", "OR", "AZ", "UT", "NV"]
DOS_2026 = date(2026, 8, 14)

GOLD_MET_NO_RED_FLAGS = {
    "G1_red_flag_indication": "not_applicable",
    "G2_red_flag_list": "not_applicable",
    "G3_first_month": "met",
    "G4_four_weeks_conservative": "met",
    # Exclusions that don't describe the case are not_applicable (matcher convention).
    "G5_ddd_hnp_no_surgery": "not_applicable",
    "G6_findings_affect_treatment": "met",
    "G7_duplication": "not_applicable",
}
GOLD_RED_FLAG = {
    "G1_red_flag_indication": "met",
    "G2_red_flag_list": "met",
    "G3_first_month": "met",  # the first-month rule has a red-flag exception
    "G4_four_weeks_conservative": "not_applicable",
    "G5_ddd_hnp_no_surgery": "not_applicable",
    "G6_findings_affect_treatment": "met",
    "G7_duplication": "not_applicable",
}
GOLD_TOO_EARLY = {**GOLD_MET_NO_RED_FLAGS, "G3_first_month": "not_met", "G4_four_weeks_conservative": "not_met"}

PLANS_AFTER_MRI = [
    "MRI to localize the level before a planned L4-L5 epidural steroid injection",
    "MRI results will decide between epidural steroid injection and surgical referral",
    "Spine surgery referral is under consideration pending MRI findings",
]
RED_FLAG_SETS = [
    (["History of cancer", "Pain that worsens when supine or at night"], "MRI to evaluate for spinal metastasis given cancer history"),
    (["Saddle anesthesia", "Recent onset of bladder dysfunction"], "Urgent MRI to rule out cauda equina syndrome"),
    (["Fever", "IV drug abuse"], "Urgent MRI to evaluate for spinal epidural abscess"),
    (["Minor trauma in a potentially osteoporotic patient"], "MRI to evaluate for vertebral compression fracture"),
]


def conservative(onset: date, dos: date, weeks: float) -> list[Treatment]:
    start = onset + timedelta(days=rng.randint(3, 7))
    end = start + timedelta(days=round(weeks * 7))
    assert end < dos, (start, end, dos)
    return [
        Treatment(kind="nsaids", start=onset + timedelta(days=1), end=end, response="partial"),
        Treatment(kind="physical_therapy", start=start, end=end, sessions=round(weeks * 2), response="no_improvement"),
    ]


def scenarios() -> list[Scenario]:
    out: list[Scenario] = []
    names = iter(NAMES)

    def add(group, plan_type, payer, policy, dos, carc, reason, facts, expected, icd10=("M54.50",)):
        n = len(out) + 1
        out.append(
            Scenario(
                case_id=f"case_{n:03d}",
                group=group,
                patient_name=next(names),
                plan_type=plan_type,
                payer=payer,
                practice_state=rng.choice(NORIDIAN_STATES),
                policy=policy,
                icd10=list(icd10),
                dos=dos,
                notice_date=dos + timedelta(days=rng.randint(10, 21)),
                carc=carc,
                reason_text=reason,
                facts=facts,
                expected=expected,
            )
        )

    # A: MA, all criteria met (two earlier DOS exercise version selection → L34220 v37).
    for i in range(8):
        dos = date(2025, 6, 2) if i >= 6 else DOS_2026 - timedelta(days=rng.randint(0, 20))
        onset = dos - timedelta(days=rng.randint(70, 100))
        add("A_ma_met", "MA", rng.choice(MA_PLANS), "L34220", dos, ["50"],
            "Not medically necessary. The documentation submitted does not support the need for advanced imaging.",
            Facts(age=rng.randint(66, 82), sex=rng.choice("FM"), onset=onset,
                  treatments=conservative(onset, dos, rng.choice([5, 6, 7, 8])),
                  neuro_exam="normal", radiculopathy=rng.choice(["none", "subjective"]),
                  plan_after_mri=rng.choice(PLANS_AFTER_MRI), surgery_or_injection_considered=True),
            Expected(route="clinical_review", verdict="appeal", gold=GOLD_MET_NO_RED_FLAGS,
                     why="No red flags; failed at least four weeks of conservative care; findings will change treatment."))

    # B: Aetna commercial: radiculopathy with objective findings, 5 weeks of therapy (CPB 0236 needs 6).
    for _ in range(5):
        dos = DOS_2026 - timedelta(days=rng.randint(0, 20))
        onset = dos - timedelta(days=rng.randint(45, 55))
        add("B_aetna_5_of_6_weeks", rng.choice(["COMMERCIAL_ACA", "COMMERCIAL_ERISA"]), "Aetna (synthetic member)", "AETNA-0236", dos, ["50"],
            "Not medically necessary per Clinical Policy Bulletin 0236.",
            Facts(age=rng.randint(38, 62), sex=rng.choice("FM"), onset=onset,
                  treatments=conservative(onset, dos, 5),
                  neuro_exam="deficit", radiculopathy="objective",
                  plan_after_mri=rng.choice(PLANS_AFTER_MRI), surgery_or_injection_considered=True),
            Expected(route="clinical_review", verdict="dont_appeal",
                     gold={"A1_radiculopathy_6_weeks": "not_met"},
                     why="Aetna requires no improvement after 6 weeks of conservative therapy for radiculopathy; the chart shows 5. "
                         "Don't appeal yet: re-evaluate after week 6 and resubmit if still no improvement."),
            icd10=("M54.16",))

    # C: MA required a plain X-ray first; Medicare's LCD has no such requirement (OIG pattern).
    for _ in range(4):
        dos = DOS_2026 - timedelta(days=rng.randint(0, 20))
        onset = dos - timedelta(days=rng.randint(60, 90))
        add("C_ma_xray_demand", "MA", rng.choice(MA_PLANS), "L34220", dos, ["50"],
            "Denied: plain radiographs of the lumbar spine are required before advanced imaging.",
            Facts(age=rng.randint(66, 84), sex=rng.choice("FM"), onset=onset,
                  treatments=conservative(onset, dos, rng.choice([5, 6])),
                  neuro_exam="normal", plan_after_mri=rng.choice(PLANS_AFTER_MRI), surgery_or_injection_considered=True),
            Expected(route="clinical_review", verdict="appeal", gold=GOLD_MET_NO_RED_FLAGS,
                     why="L34220 does not require prior radiographs; all of its criteria are met. MA plans must follow Medicare coverage criteria."))

    # D: red flag present, imaging inside the first month.
    for flags, plan in RED_FLAG_SETS:
        dos = DOS_2026 - timedelta(days=rng.randint(0, 20))
        onset = dos - timedelta(days=rng.randint(8, 18))
        add("D_red_flag_early", "MA", rng.choice(MA_PLANS), "L34220", dos, ["50"],
            "Not medically necessary: imaging within the first month of symptoms.",
            Facts(age=rng.randint(66, 84), sex=rng.choice("FM"), onset=onset, red_flags=flags,
                  neuro_exam="deficit" if "Saddle anesthesia" in flags else "normal",
                  plan_after_mri=plan, surgery_or_injection_considered=False),
            Expected(route="clinical_review", verdict="appeal", gold=GOLD_RED_FLAG,
                     why=f"Red flag(s) documented ({', '.join(flags)}); the first-month limit doesn't apply."))

    # E: no red flags, only ~2 weeks of conservative care.
    for _ in range(3):
        dos = DOS_2026 - timedelta(days=rng.randint(0, 20))
        onset = dos - timedelta(days=rng.randint(20, 26))
        add("E_ma_too_early", "MA", rng.choice(MA_PLANS), "L34220", dos, ["50"],
            "Not medically necessary. Insufficient trial of conservative treatment.",
            Facts(age=rng.randint(66, 84), sex=rng.choice("FM"), onset=onset,
                  treatments=conservative(onset, dos, 2), neuro_exam="normal",
                  plan_after_mri=rng.choice(PLANS_AFTER_MRI), surgery_or_injection_considered=True),
            Expected(route="clinical_review", verdict="dont_appeal", gold=GOLD_TOO_EARLY,
                     why="Symptoms under one month and under four weeks of conservative care, with no red flags. The denial is consistent with L34220."))

    # F: administrative denials (our own labels; CARC codes shown bare).
    for carc, reason, why in [
        ("16", "Claim is missing the referring provider's NPI.", "Resubmit a corrected claim with the referring provider NPI."),
        ("27", "Member's coverage was not active on the date of service.", "Verify eligibility; bill the correct payer or the patient."),
        ("29", "Claim received after the filing deadline.", "Check proof of timely filing; appeal only with that proof."),
    ]:
        dos = DOS_2026 - timedelta(days=rng.randint(0, 20))
        onset = dos - timedelta(days=rng.randint(60, 90))
        add("F_administrative", "MA", rng.choice(MA_PLANS), "L34220", dos, [carc], reason,
            Facts(age=rng.randint(66, 84), sex=rng.choice("FM"), onset=onset,
                  treatments=conservative(onset, dos, 6), plan_after_mri=rng.choice(PLANS_AFTER_MRI),
                  surgery_or_injection_considered=True),
            Expected(route="fix_checklist", verdict="fix_checklist", why=why))

    # G: plan exclusions (not winnable on medical necessity).
    for carc, reason in [
        ("96", "Non-covered: advanced imaging at an out-of-network freestanding facility is excluded under this plan."),
        ("204", "This service is not covered under the member's current benefit plan."),
        ("96", "Non-covered: imaging requested for an employment physical is excluded."),
    ]:
        dos = DOS_2026 - timedelta(days=rng.randint(0, 20))
        onset = dos - timedelta(days=rng.randint(60, 90))
        add("G_plan_exclusion", "COMMERCIAL_ERISA", "Pinecrest Employer Health Plan (synthetic)", "L34220", dos, [carc], reason,
            Facts(age=rng.randint(30, 60), sex=rng.choice("FM"), onset=onset,
                  treatments=conservative(onset, dos, 6), plan_after_mri=rng.choice(PLANS_AFTER_MRI),
                  surgery_or_injection_considered=True),
            Expected(route="not_winnable", verdict="not_winnable",
                     why="The plan excludes this service; medical necessity evidence won't change the outcome. Explain to the patient."))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="cases")
    args = ap.parse_args()
    items = scenarios()
    assert len(items) == 30, len(items)
    for s in items:
        s.save(Path(args.out))
    groups = {}
    for s in items:
        groups[s.group] = groups.get(s.group, 0) + 1
    print(f"wrote {len(items)} scenarios to {args.out}/: {groups}")


if __name__ == "__main__":
    main()
