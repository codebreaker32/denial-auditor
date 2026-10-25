# Devpost submission draft: Denial Auditor

Track: **Best Apps & Agents**. Team: **Road House** (Aman Bihari, Bhawna).
Statistics are taken word for word from `docs/facts.md`; don't add any that aren't in that file.

## Tagline
Payers check your MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same.

## Inspiration
Small practices lose imaging claims they should win. In ACA Marketplace plans, insurers denied 19% of in-network claims in 2024, and fewer than 1% of those denials were appealed (KFF). In Medicare Advantage, 80.7% of appealed prior-auth denials were overturned in 2024, but only 11.5% were appealed (KFF). A 2022 federal audit found that 13% of sampled MA prior-auth denials met Medicare coverage rules, partly because plans required an x-ray before advanced imaging when Medicare rules don't (HHS OIG).

The work that wins these appeals is reading: finding the payer's policy as it stood on the date of service, matching each criterion to the chart, and quoting both exactly. A billing specialist at a three-doctor practice doesn't have hours for each denial. General-purpose AI letter writers do produce a letter, but they can't show that what they quote exists.

## What it does
Each denial arrives as a faxed letter. Denial Auditor:
1. **Reads** the scan (Nemotron 3.5 Super-VL) and **triages** it with a reason-code table: administrative denials get a fix checklist, plan exclusions are marked "not winnable", and clinical denials go on to review.
2. **Fetches the policy in effect on the date of service.** Medicare LCDs come from the CMS Coverage API, which keeps every version (a June 2025 service date gets L34220 v37; an August 2026 one gets v40). Aetna's bulletin is located at runtime with **Tavily search**.
3. **Splits the policy into rules.** Code numbers every sentence; Nemotron 3 Super picks sentence ids, so each rule is the payer's own wording, cut from the source.
4. **Checks each rule against the chart.** Two Nemotron 3 Super votes per rule, and Nemotron 3 Ultra referees when they split. Every chart quote is located in its note by code. A "met" without verified evidence becomes "missing documentation", and durations are computed from dates, never by a model.
5. **Decides with a fixed rule:** appeal, ask the physician, don't appeal yet, fix and resubmit, or not winnable.
6. **Drafts the appeal.** Ultra drafts from pre-verified quotes only, Super critiques as the payer's medical reviewer, and Ultra revises. The **citation gate** blocks export unless every quoted line matches the policy fetched for the case or the chart, word for word. Edit "four weeks" to "two weeks" and the quote turns pink and export is disabled.

**Before you submit** runs the same checks on a prior-auth request. When the chart falls short of a waiting period, code works out the earliest date it's met from the chart's own dates.

**Policy watch** runs nightly beside the app with a $0 model cap. It flags open cases whose cited policy changed and names the rules whose wording moved.

A person reviews and sends everything; the tool never submits anything. Deadlines come from a fixed table checked against eCFR (42 CFR 422.582, 405.942; 29 CFR 2560.503-1).

## How we built it
- **NVIDIA Nemotron on Nebius Token Factory** for every model step. Five models, each chosen per step by measurement (`scripts/probe_models.py`):

  | Model | Step |
  |---|---|
  | Super-VL | Reads the scanned letter |
  | Nano, thinking off | Fact extraction: about 10× faster than with thinking on |
  | Super | Sentence picking: 7/7 gold criteria in 3/3 runs |
  | Super ×2 + Ultra | Rule-by-rule matching and referee |
  | Ultra / Super | Appeal draft, critique and revision |

  Every call uses `response_format` json_schema and is validated with pydantic.
- **Tavily** at runtime to locate the commercial payer's current bulletin.
- **CMS Coverage API** for versioned Medicare policy text.
- **FastAPI** plus a hand-built HTML/CSS/JS frontend ("highlighter on photocopy": policy and chart as photocopied sheets, with rule status as highlighter colour).
- **AWS Lightsail** container hosting, with the policy watch running beside the app.
- **Spend caps enforced in code.** A custom httpx transport checks the worst-case cost of every Token Factory request against a project cap before sending it. The whole build, 30-case evaluations included, stayed within a $27 cap.

## Evaluation
30 synthetic cases in 7 groups:
- Medicare Advantage cases that meet the policy, including two dated before a version change;
- Aetna's 6-week rule at 5 weeks;
- MA plans demanding an x-ray the policy doesn't require (the OIG pattern);
- red flags allowing early imaging;
- too-early imaging;
- administrative denials;
- plan exclusions.

| | Super ×2 + Ultra referee | Nano, one vote |
|---|---|---|
| Triage | 30/30 | 29/29 ¹ |
| Recommendation | 30/30 | 16/29 (55%) |
| Gold rule statuses | 138/138 | 119/131 (91%) |
| Cost per case | $0.048 | $0.010 |

¹ One Nano run produced malformed output (a runaway answer cut off mid-JSON) and isn't scored. Nano's misses are mostly the red-flag route marked as blocking when the patient simply has no red flags (8 of 18), and four weeks of documented care marked as undocumented (3 of 18). Two Super votes with an Ultra referee cost about 5× more and get every recommendation right on this set.

These are synthetic cases with our own ground truth. They show the pipeline is consistent on the situations we designed, not how it performs on real charts.

## Challenges
- **Models paraphrase policy text.** Asking for spans gave near-quotes. We switched to sentence ids, so spans come from the source by construction.
- **"Supports" vs "met".** Early matchers marked an exclusion that didn't describe the patient as "met". Effect-based statuses (supports / blocks / not relevant / undocumented) plus code rules took verdict accuracy from 1 in 5 on a pilot to 20/24 on the clinical cases; two votes per rule with an Ultra referee took it to 24/24, and 30/30 on the full set.
- **Aetna has more than one route.** Its bulletin has a separate pre-injection route, which correctly qualified some of our synthetic patients. We had to fix our scenarios, not the model.
- **Unicode.** Models emit U+2011 non-breaking hyphens. The gate treats hyphen variants as equal but keeps en and em dashes distinct.

## Accomplishments
- An appeal can't be exported unless every quote is found word for word in the policy text fetched for that case or in the chart.
- A fixed, testable decision rule, plus an audit trail showing every model call, vote and cost.
- The policy version is chosen by date of service, and the policy watch catches changes.

## What we learned
Reasoning models are good judges of one rule at a time, and bad sources of truth for quotes, dates and arithmetic. The product got better each time we moved one of those into code.

## What's next
More imaging policies and payers (CT, other Medicare contractors), real fax intake, and a pilot with a small practice's billing team on de-identified denials.

## Feedback on Nebius Token Factory and NVIDIA Nemotron (Most Valuable Feedback)
1. **Structured output works on every Nemotron 3 model we tried.** Nano, Super, Ultra, Lightning and Super-VL all honoured `response_format` json_schema. Please document this per model in `GET /v1/models` (`supported_features`), so builders don't have to probe.
2. **Reasoning can use up `max_tokens` and return empty `content`.** The trace goes to `message.reasoning` and `content` comes back empty with `finish_reason=length`. We retry with double the tokens. A documented `reasoning_budget`, or a guaranteed answer after reasoning, would remove this class of failure.
3. **`chat_template_kwargs: {enable_thinking: false}` works on Nano** and made extraction about 10× faster (0.4 s vs 4.2 s in our probe). It's easy to miss; a first-class parameter would help.
4. **`content` starts with a newline** on reasoning models, so JSON parsers need a strip.
5. **Model IDs mix formats** (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/Nemotron-3_5-Lightning`). Consistent, case-insensitive IDs or aliases would prevent 404s.
6. **Lightning took 50–230 s even for small prompts** in our tests (Oct 21), so we didn't use it on any request path. A latency note per model on the models page would help with planning.
7. **No per-key spending cap.** We built one (an httpx transport that checks worst-case cost before each request). A server-side hard cap per API key would make hackathon and production budgets safer.
8. **Images were billed at $0 on Super-VL.** That's great for document intake; please confirm whether it's intended so we can rely on it.

## Built with
nemotron, nebius-token-factory, tavily, python, fastapi, pydantic, httpx, javascript, aws-lightsail, cms-coverage-api
