#!/usr/bin/env python3
"""Generate synthetic chart notes for each scenario with Nemotron Super, then check them.

The check is deterministic, so the pipeline's own extractor never grades itself:
every required fact sentence must appear verbatim in a note, carry the spec's
date or value, and every note must start with the SYNTHETIC banner. A failing
case is regenerated at most twice; the failure rate is reported.

Usage: ./.venv/bin/python eval/gen_notes.py [--cases cases] [--only case_001,...] [--workers 4] [--force]
"""

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from nebius_nvidia.cost import CostTracker
from nebius_nvidia.llm import SUPER, LLMFormatError, structured
from nebius_nvidia.models import ChartNote
from nebius_nvidia.scenario import SYNTHETIC_BANNER, Scenario
from nebius_nvidia.text import normalize


def fmt(d: date) -> str:
    return d.strftime("%m/%d/%Y")


class NoteDraft(BaseModel):
    date: str  # MM/DD/YYYY
    note_type: Literal["initial_visit", "pt_note", "follow_up", "imaging_order"]
    author_role: str
    text: str


class NoteSet(BaseModel):
    notes: list[NoteDraft] = Field(min_length=3, max_length=4)
    fact_sentences: dict[str, str]  # required key → the exact sentence in a note that states it


SYSTEM = f"""You write realistic but entirely SYNTHETIC outpatient chart notes for testing a medical-billing tool.
Never use real people, real clinics or real identifiers. The patient name is a placeholder.

Write exactly the notes listed under NOTE SCHEDULE, with those dates and types, in that order.
Every note's text MUST begin with the line: {SYNTHETIC_BANNER}
Write dates exactly as MM/DD/YYYY, using the dates given.
- Chronology: a note may only mention events on or before its own date. A treatment still in progress is "started on <date>"; only a note dated on/after a treatment's end date may state its full course with start and end dates.
- The last follow-up note before the imaging order must restate the full conservative-treatment course (each treatment with start date, end date, sessions and response) and the plan.
- Write natural clinical prose (HPI, exam, assessment, plan). Do NOT copy the fact sheet's wording; vary sentence structure as a real clinician would.
- Do NOT add treatments, imaging, diagnoses or red flags that are not on the fact sheet.
- Ordinary negatives (e.g. "Denies fever or weight loss") are fine ONLY if the fact sheet says there are no red flags.

Then fill fact_sentences: for each key listed under REQUIRED KEYS, copy the ONE sentence from your notes that states that fact, character for character."""


def fact_sheet(s: Scenario) -> tuple[str, dict[str, list[str]]]:
    """Facts for the prompt (as data, so the model writes prose instead of copying),
    and for each required key the tokens its sentence must contain."""
    f = s.facts
    facts: dict = {
        "patient": {"name": s.patient_name, "age": f.age, "sex": "female" if f.sex == "F" else "male"},
        "payer": s.payer,
        "diagnosis_code": s.icd10,
        "low_back_pain_onset": fmt(f.onset),
        "lumbar_mri_ordered_on": fmt(s.dos),
        "conservative_treatment": [
            {"type": t.kind, "start": fmt(t.start), "end": fmt(t.end), "sessions": t.sessions, "response": t.response}
            for t in f.treatments
        ],
        "red_flags": f.red_flags or "none (no trauma, cancer, fever, weight loss, bladder or bowel symptoms, saddle anesthesia, progressive deficit)",
        "neurologic_exam": {
            "normal": "normal lower-extremity strength, reflexes and sensation",
            "deficit": "abnormal: give one specific motor or reflex finding",
            "not_documented": "not performed or not documented",
        }[f.neuro_exam],
        "radiculopathy": {
            "none": "none",
            "subjective": "reports pain radiating down one leg, no objective findings",
            "objective": "radiculopathy with objective findings (e.g. diminished ankle reflex and L5/S1 weakness)",
        }[f.radiculopathy],
        "prior_lumbar_imaging": f.prior_imaging or "none",
        "plan_if_mri": f.plan_after_mri,
    }
    need: dict[str, list[str]] = {"onset": [fmt(f.onset)]}
    for i, t in enumerate(f.treatments):
        need[f"treatment_{i}"] = [fmt(t.start), fmt(t.end)]
    if f.red_flags:
        for i, rf in enumerate(f.red_flags):
            need[f"red_flag_{i}"] = []  # synonyms are fine ("intravenous drug use"); the sentence must exist
    else:
        need["no_red_flags"] = []
    if f.radiculopathy != "none":
        need["radiculopathy"] = []
    if f.plan_after_mri:
        need["plan_after_mri"] = []
    keys = "\n".join(f"- {k}" for k in need)
    sched = "\n".join(f"- {fmt(d)}: {t}" for d, t in schedule(s))
    return (
        f"FACTS (JSON):\n{json.dumps(facts, indent=1)}\n\nNOTE SCHEDULE:\n{sched}\n\nREQUIRED KEYS:\n{keys}",
        need,
    )


def schedule(s: Scenario) -> list[tuple[date, str]]:
    """Fixed note dates/types: initial visit, treatment summary (if any), follow-up, imaging order."""
    from datetime import timedelta

    f = s.facts
    out = [(f.onset + timedelta(days=1), "initial_visit")]
    if f.treatments:
        end = max(t.end for t in f.treatments)
        out.append((end, "pt_note"))
        out.append((min(end + timedelta(days=5), s.dos - timedelta(days=1)), "follow_up"))
    else:
        out.append((f.onset + timedelta(days=max(2, (s.dos - f.onset).days // 2)), "follow_up"))
    out.append((s.dos, "imaging_order"))
    return out


def check(ns: NoteSet, need: dict[str, list[str]], expected_dates: list[str] | None = None,
          forbidden: tuple[str, ...] = ()) -> list[str]:
    problems = []
    for term in forbidden:
        if any(term in n.text.lower() for n in ns.notes):
            problems.append(f"notes mention '{term}', which is not on the fact sheet; remove it")
    if expected_dates is not None and [n.date for n in ns.notes] != expected_dates:
        problems.append(f"note dates {[n.date for n in ns.notes]} must be exactly {expected_dates}")
    texts = [n.text for n in ns.notes]
    for n in ns.notes:
        if not n.text.lstrip().startswith(SYNTHETIC_BANNER):
            problems.append(f"note {n.date} missing banner")
    all_notes = normalize("\n".join(texts))
    for key, tokens in need.items():
        sent = ns.fact_sentences.get(key)
        if not sent:
            problems.append(f"no sentence for {key}")
            continue
        if normalize(sent) not in all_notes:
            problems.append(f"{key} sentence not in notes")
        for tok in tokens:
            if tok.lower() not in sent.lower():
                problems.append(f"{key} sentence lacks {tok!r}")
    return problems


def generate(s: Scenario, case_dir: Path, tracker: CostTracker) -> dict:
    sheet, need = fact_sheet(s)
    problems: list[str] = []
    for attempt in range(3):
        msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": sheet}]
        if problems:
            msgs.append({"role": "user", "content": "Previous attempt failed these checks; fix them: " + "; ".join(problems)})
        try:
            ns = structured(SUPER, msgs, NoteSet, max_tokens=8192, step="gen_notes", tracker=tracker)
        except LLMFormatError as e:
            problems = [str(e)[:200]]
            continue
        # Plans the fact sheet doesn't include must not appear (they open other policy routes).
        plan = (s.facts.plan_after_mri or "").lower()
        forbidden = tuple(t for t in ("injection", "epidural") if t not in plan)
        problems = check(ns, need, [fmt(d) for d, _ in schedule(s)], forbidden)
        if not problems:
            notes = [
                ChartNote(
                    note_id=f"{s.case_id}-n{i}",
                    date=date(int(d.date[6:10]), int(d.date[0:2]), int(d.date[3:5])),
                    note_type=d.note_type,
                    author_role=d.author_role,
                    text=d.text,
                )
                for i, d in enumerate(ns.notes, start=1)
            ]
            (case_dir / "notes.json").write_text(json.dumps([n.model_dump(mode="json") for n in notes], indent=1))
            return {"case": s.case_id, "ok": True, "attempts": attempt + 1}
    return {"case": s.case_id, "ok": False, "attempts": 3, "problems": problems}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default="cases")
    ap.add_argument("--only", default="")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    dirs = sorted(p for p in Path(args.cases).iterdir() if (p / "scenario.json").exists())
    if args.only:
        dirs = [d for d in dirs if d.name in args.only.split(",")]
    if not args.force:
        dirs = [d for d in dirs if not (d / "notes.json").exists()]
    tracker = CostTracker()
    with ThreadPoolExecutor(args.workers) as pool:
        results = list(pool.map(lambda d: generate(Scenario.load(d), d, tracker), dirs))
    ok = [r for r in results if r["ok"]]
    regen = sum(r["attempts"] > 1 for r in ok)
    print(f"{len(ok)}/{len(results)} cases ok ({regen} needed regeneration), ${tracker.total_usd:.4f}")
    for r in results:
        if not r["ok"]:
            print("FAILED", r["case"], r["problems"][:5])


if __name__ == "__main__":
    main()
