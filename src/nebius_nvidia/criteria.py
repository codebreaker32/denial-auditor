"""Policy text → numbered, checkable criteria, each anchored to a verbatim span.

The model never copies policy wording. Code splits the fetched text into
numbered sentence units (text.segment); the model only says which units form
each criterion. Spans are then cut from the source by offset, so every
criterion's wording is the policy's own characters by construction.

Model choice (scripts/check_criteria.py on L34220 v40, 2026-10-21): Super and Ultra
both recalled 7/7 gold criteria in 3/3 runs; Super is ~3x cheaper (~$0.01 vs ~$0.03,
60-100 s vs ~25 s). Lightning was slowest (~230 s) and missed one; Nano 6/7.
The result is cached per policy version, so latency only matters on a cache miss.

Results are cached per (policy sha256, model) under .cache/criteria/.
"""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from nebius_nvidia.llm import SUPER, structured
from nebius_nvidia.models import Criterion, PolicyDoc
from nebius_nvidia.text import locate, segment

CACHE_DIR = Path(".cache/criteria")

SYSTEM = """You identify the coverage criteria in a health-insurance coverage policy so a billing specialist can check a patient's chart against each one.

The policy is given as numbered sentences, [S1], [S2], ... Each bullet is its own sentence.

Return every criterion that decides whether the service is covered for a patient:
- indications: each sentence saying when the service "may be indicated", "is covered" or "may be appropriate" (sentences starting "For example" often state a rule; include them when they do);
- red flags: the list of red-flag conditions, as ONE criterion made of the sentence introducing the list plus all its bullets;
- durations / prior treatment: required time periods or trials of conservative care;
- documentation: what the medical record must show;
- limitations and exclusions: when the service is not reasonable and necessary.

Skip background, definitions, technology descriptions, contraindications, and payment, billing and coding rules (units, professional components, who bills).

For each criterion give sentence_ids: the consecutive sentence numbers (integers) that state it. Use the fewest sentences that fully state the rule.
summary is your own one-line plain-English paraphrase (display-only, never quoted). applies_when states the condition under which it applies (e.g. "no red flags present"), else null."""


class CriterionPick(BaseModel):
    summary: str
    kind: Literal["indication", "red_flag", "duration", "documentation", "exclusion"]
    applies_when: str | None = None
    sentence_ids: list[int] = Field(min_length=1)


class CriteriaOut(BaseModel):
    criteria: list[CriterionPick] = Field(min_length=1)


def numbered(doc: PolicyDoc) -> tuple[str, list[tuple[int, int]]]:
    units = segment(doc.text)
    return "\n".join(f"[S{i}] {doc.text[s:e]}" for i, (s, e) in enumerate(units, start=1)), units


def _runs(ids: list[int]) -> list[list[int]]:
    """Group sorted ids into consecutive runs: [3,4,5,9] → [[3,4,5],[9]]."""
    runs: list[list[int]] = []
    for i in sorted(set(ids)):
        if runs and i == runs[-1][-1] + 1:
            runs[-1].append(i)
        else:
            runs.append([i])
    return runs


def build_criteria(picks: list[CriterionPick], doc: PolicyDoc, units: list[tuple[int, int]]) -> list[Criterion]:
    """Turn the model's sentence picks into criteria with spans cut from the source.

    Out-of-range ids are dropped; a non-consecutive pick becomes one criterion per run.
    """
    doc_id = f"{doc.policy_id}v{doc.version}"
    out: list[Criterion] = []
    for pick in picks:
        valid = [i for i in pick.sentence_ids if 1 <= i <= len(units)]
        for run in _runs(valid):
            start, end = units[run[0] - 1][0], units[run[-1] - 1][1]
            out.append(
                Criterion(
                    criterion_id=f"C{len(out) + 1}",
                    doc_id=doc_id,
                    summary=pick.summary,
                    verbatim_span=doc.text[start:end],
                    kind=pick.kind,
                    applies_when=pick.applies_when,
                    span_start=start,
                    span_end=end,
                    span_verified=True,
                )
            )
    return out


def extract_criteria(
    doc: PolicyDoc, model: str = SUPER, tracker=None, use_cache: bool = True, thinking: bool | None = None
) -> list[Criterion]:
    tag = "" if thinking is None else f"_think{int(thinking)}"
    cache = CACHE_DIR / f"{doc.sha256[:16]}_{model.split('/')[-1]}{tag}.json"
    if use_cache and cache.exists():
        return [Criterion.model_validate(c) for c in json.loads(cache.read_text())]

    text, units = numbered(doc)
    out = structured(
        model,
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Policy: {doc.title} ({doc.citation()})\n\n<policy>\n{text}\n</policy>"},
        ],
        CriteriaOut,
        max_tokens=16384,
        step="criteria",
        tracker=tracker,
        thinking=thinking,
    )
    criteria = build_criteria(out.criteria, doc, units)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps([c.model_dump() for c in criteria], indent=1))
    return criteria


def recall_against_gold(criteria: list[Criterion], doc: PolicyDoc, anchors: dict[str, str]) -> dict[str, bool]:
    """For each gold anchor phrase, is it inside some verified criterion span?"""
    result = {}
    for gid, anchor in anchors.items():
        hit = locate(anchor, doc.text)
        result[gid] = bool(hit) and any(
            c.span_verified and c.span_start <= hit[0] and hit[1] <= c.span_end for c in criteria
        )
    return result
