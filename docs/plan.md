# Denial Auditor: build plan (Oct 20 → Oct 30, 10:00 am PT)

> "Payers check your MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same."

Sources: [research/competitors.md](research/competitors.md), [research/data-sources.md](research/data-sources.md), [track-decision.md](track-decision.md).

## Key design decisions from the research

1. **The lead story is Medicare Advantage + Medicare LCDs.** MA plans must follow Medicare coverage rules, and HHS OIG (OEI-09-18-00260) found that **13% of MA prior-auth denials met Medicare coverage rules**. One cause it names is requiring an X-ray before advanced imaging. The CMS Coverage API is free, versioned and can't be easily rate-limited away, which gives us the most reliable data and the strongest statistic. Commercial (UHC) is the second payer, used in the demo's "4 weeks vs 6 weeks" twist.
2. **Policy sources:**
   - **Allowed:** the CMS Coverage API (primary), UHC public PDFs (cut down to the relevant section before extraction), Aetna CPB HTML.
   - **Never feed to a model or store:** eviCore and Carelon (their terms forbid copying and AI use) and ACR Appropriateness Criteria (link and name only).
3. **"The version in effect on the date of service" is a lookup, not a guess.** CMS LCD versions carry start and end effective dates, and retired versions can still be fetched.
4. **CPT:** show bare codes only, never the AMA descriptors, and include the AMA attribution line. Full LCD text through the CMS API needs a one-hour licence token, which means accepting the AMA CPT licence for personal, non-commercial use. That's fine for a hackathon demo, but the README must disclose it. ICD-10 codes are fine.
5. **Synthetic data:** write a **scenario spec** with known true answers → Nemotron writes realistic chart notes from it → the eval checks that the pipeline recovers the spec. Synthea can't produce what we need (no low-back-pain/MRI modules, thin notes).
6. **Tavily must stay load-bearing** for the $3k bonus, even though CMS covers Medicare. Its runtime jobs:
   - finding commercial payer policies (UHC/Aetna) for a procedure;
   - finding the **MA plan's own published criteria** (CMS-4201-F requires them to be public);
   - finding supporting clinical literature and guidelines cited in the appeal (Tavily search, quoting only what's allowed).

   Never claim Tavily is the only source.

## Pipeline

```
denial letter (PDF/scan) ─► [Super-VL] read ─► [Nano] extract: payer, CPT, ICD-10, DOS, reason code
                                                  │
                                    [Nano] TRIAGE by reason class
              ┌──────────────────────┼─────────────────────────┐
        administrative          plan exclusion              clinical
        → fix checklist         → "not winnable" +           │
          (no LLM appeal)         patient explanation        ▼
                              policy resolver: CMS Coverage API (version by DOS)
                              / Tavily search+extract (UHC, Aetna, MA plan criteria)
                                             │
                              [Lightning] policy → numbered criteria (each with verbatim span)
                                             │
                              [Nano ×N] criterion ↔ chart notes: met / not met / missing + evidence span
                                             │
                     missing ─► documentation request to physician
                                             │
                              [Ultra] draft appeal ─► [Super] payer-reviewer critique ─► [Ultra] revise
                                             │
                              CITATION GATE: every quote must exactly match fetched text, else block export
                                             │
                              deadline from fixed rules table (plan type) ─► human sends it

Prevention mode: the same resolver + criteria + matcher run on a prior-auth request BEFORE submission.
Drift watcher: a nightly Nebius Serverless Job re-fetches the policies for open cases and flags version changes.
```

Estimated cost per case: Lightning on a ~30k-token LCD ≈ $0.002, Nano matching ≈ $0.001, Ultra draft and revision ≈ $0.015, so **about $0.02–0.04 per case**. A 30-case eval run costs ~$1. The UI shows cost per case using the budget ledger.

## Code layout (inside `src/nebius_nvidia/`)

| Module | Responsibility |
|---|---|
| `policy.py` | CMS Coverage API client (licence token, LCD list, version by DOS); Tavily resolver for UHC/Aetna/MA criteria; source allowlist that blocks eviCore/Carelon/ACR text |
| `criteria.py` | Lightning: policy text → `[Criterion(id, text, verbatim_span, source_url, version)]` |
| `intake.py` | Super-VL + Nano: denial letter → structured `Denial` |
| `triage.py` | reason-class routing; fix checklist for administrative denials |
| `match.py` | Nano per criterion: status + chart evidence span |
| `appeal.py` | Ultra draft → Super critique → Ultra revise; documentation requests |
| `citations.py` | exact-match gate (normalised whitespace only; no fuzzy matching) |
| `rules.py` | **fixed** deadline and appeal-level table by plan type (MA, Medicare FFS, commercial, ACA) |
| `app.py` | Streamlit UI: worklist → case → evidence board → appeal |
| `jobs/drift.py` | Serverless Job: re-check policy versions for open cases |
| `eval/` | scenario specs, note generator, scorer, ablation |

## Team split (3 roles; with 2 people, merge Role C into A and B)

- **A, Pipeline:** `policy`, `criteria`, `match`, `citations`, `appeal`.
- **B, Data & eval:** scenario specs, synthetic notes and denial letters, `intake`, `triage`, `rules`, the eval and the ablation (Nano-only vs routed).
- **C, Product:** Streamlit UI, Nebius Serverless Endpoint deployment, drift job, video, Devpost write-up.

## Schedule

| Day | Date | Goal (end-of-day checkpoint) |
|---|---|---|
| 1 | Tue Oct 20 | Repo public with an **Apache-2.0** licence; CMS API fetches L34220 by DOS; 3 scenario specs written |
| 2 | Wed Oct 21 | Criteria extraction works on L34220 + UHC lumbar section; synthetic notes for 10 cases |
| 3 | Thu Oct 22 | Matcher + citation gate end to end on one case (CLI); intake reads a synthetic faxed denial |
| 4 | Fri Oct 23 | Triage + rules table; appeal draft → critique → revise; UI v1 (worklist + evidence board) |
| 5 | Sat Oct 24 | **Feature freeze for appeals.** Deploy to a Nebius Serverless Endpoint (demo URL live) |
| 6 | Sun Oct 25 | Prevention mode; drift watcher as a Serverless Job; 30 eval cases generated |
| 7 | Mon Oct 26 | Eval + ablation numbers; fix the worst failure class |
| 8 | Tue Oct 27 | Design polish (the Design criterion is 25%); precompute demo cases; rate-limit the public demo |
| 9 | Wed Oct 28 | Record and edit the video (<3 min); README, architecture diagram, Devpost text, feedback section |
| 10 | Thu Oct 29 | **Submit by Thursday evening PT**; Friday morning is buffer only |

## Demo case (from data-sources.md)

- Synthetic patient, 67, Medicare Advantage, ICD-10 M54.50, CPT 72148 (bare code), DOS 2026-08-14.
- The MA plan denied it as "not medically necessary".
- Under L34220 v40 (Noridian, effective 10/23/2025), all criteria are met, including "at least four weeks" of conservative care: the chart shows 5 weeks. The appeal cites L34220 v40 and the OIG finding.
- The twist: the same patient on a UHC commercial plan **fails** UHC's 6-week rule, so the tool sends a documentation request instead of an appeal and tells the biller not to appeal yet.
- A tampered quote is blocked by the citation gate on camera.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Public demo burns the $27 budget | Precomputed demo cases cost nothing; live runs are rate-limited per IP; the ledger cap is still the final stop |
| Ledgers are per machine (Serverless) | Give the deployed app its own lower cap (e.g. `TOKEN_FACTORY_BUDGET_USD=8`) and keep the remainder for dev/eval; track the total by hand in the README |
| UHC PDF is 14 MB / 3,513 pages | Pre-split by section heading once; Tavily extract on the section URL where possible |
| Nemotron 3.5 Super-VL is new | Test on day 3; fallback is OCR + Nano |
| Legal/medical framing | Synthetic data only; "decision support for billing staff, not legal or medical advice"; the human sends the appeal |
| athenaOne bundles AI denial tools | Pitch on verified, criterion-level evidence, which their marketing doesn't claim |

## Open items

- [x] Team: Fine Print (Aman Bihari, Bhawna). Repo: denial-auditor.
- [ ] Confirm Nebius Serverless Endpoints/Jobs are available on the account and what they cost.
- [ ] Verify Token Factory's data-retention and training terms before any privacy claim.
- [ ] Fact-check every statistic used in the video and README (Phase 2).
