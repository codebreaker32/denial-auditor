# Plan of Action: Denial Auditor (build Oct 21 → submit Thu Oct 29)

## Context

Team **Fine Print** (Aman Bihari, Bhawna) is entering the Nebius x NVIDIA Global AI Hackathon, **Best Apps & Agents** track (deadline Fri Oct 30, 10:00 am PT).

**Product:** Denial Auditor helps billing staff at small practices win health-insurance denials for outpatient MRI/CT. It:
- finds the payer policy version in effect on the date of service (DOS);
- splits it into criteria and matches each one to chart evidence;
- turns gaps into documentation requests to the physician;
- drafts appeals whose quotes are verified word for word.

**Pivot:** a detour to add an insurance-plan chooser was dropped. India and plan-selection are roadmap material for the video's closing only.

**Current state:**
- Repo `codebreaker32/denial-auditor`: **private**, Apache-2.0.
- Budget-capped clients: `src/nebius_nvidia/llm.py` (`llm()`, `chat()`), `web.py` (`client()`, `search()`), `budget.py` ($27 Token Factory, 4,125 Tavily credits).
- Research in `docs/`.
- An unreviewed draft `policy.py` that the user wants **deleted and rewritten**.
- The CMS Coverage API licence was accepted with the user's approval.

**Decisions made:**
- Aman = pipeline + deploy; Bhawna = data/eval/UI/video.
- Streamlit + custom CSS.
- **Aetna CPB 0236** as the commercial "6-week" payer (UHC dropped: its criteria are eviCore text, which can't be reused).
- `budget.py` additions only.
- Passcode-gated live mode, with a public precomputed mode.
- Hosting on **AWS Lightsail** (user's AWS account; usage so far is covered by credits).
- Nebius stays in the story through **Token Factory** (every model call). **Update 2026-10-21:** there are no Nebius AI Cloud credits, so the drift watcher runs as a **nightly cron on the Lightsail server** instead of a Nebius Serverless Job. Sandboxes beta access was granted but isn't used, since nothing in the pipeline runs untrusted code.

**Rules that still apply:**
- Implementation starts only on approval of this plan.
- The repo stays private until the user says otherwise; remind them on Oct 28.

## Verified constraints that shape the design
- **Token Factory structured output:** `response_format` `json_schema` and `json_object` are documented, but not confirmed for Nemotron, and per-model `supported_features` is listed in `GET /v1/models?verbose=true`. **Probe on day 1 and don't depend on it.**
- Nemotron reasoning can use up `max_tokens` and leave `content` empty. `enable_thinking:false` (via `chat_template_kwargs`) is unconfirmed on TF, so probe it.
- TF rate limits return 429 with `Retry-After`, so the eval runs with at most 4 concurrent calls.
- Nebius Serverless Jobs have **no cron**: trigger by hand or with GitHub Actions `schedule:`.
- Tavily extract: official docs say nothing about PDFs. Use it on HTML (cms.gov, Aetna, MA plan pages); spend ≤2 credits testing.
- Streamlit needs **WebSockets**, so the host must be tested on day 2.

## Architecture

```
denial letter ─► intake (Super-VL for scans / Nano for text PDFs) ─► Denial
   └► triage: CARC-code table first (Nano only if no code) ─► administrative → fix checklist
                                                            ─► plan exclusion → not winnable
                                                            ─► clinical ▼
resolver: MA/FFS → CMS Coverage API, version by DOS │ commercial → Tavily search+extract (Aetna)
   └► criteria (Lightning, whole policy, cached by sha256) ─► spans verified by code (substring)
   └► facts (Nano; durations computed in code) ─► match (Nano × N) ─► deterministic verdict
        ├► missing → documentation request to the physician
        └► appeal: quote bank of verified spans → Ultra draft → Super "payer reviewer" critique → Ultra revise
             └► CITATION GATE (exact match) ─► deadline from fixed rules table ─► human exports and sends
Prevention mode = the same resolver/criteria/match run on a prior-auth request.
Drift watcher = nightly cron on the Lightsail server re-checks CMS versions for open cases (no LLM; $0 cap).
```

## Modules (`src/nebius_nvidia/` unless noted)

| Module | Owner | Key contents |
|---|---|---|
| `models.py` | both, day 1 | Pydantic models (pydantic already comes with `openai`): `PolicyDoc` (source, policy_id, version, effective_from/to, `version_basis` api-versioned or snapshot, url, fetched_at, fetched_via, text, sha256), `Criterion` (verbatim_span, offsets, kind, span_verified), `ChartNote`, `Evidence`, `CriterionMatch`, `Denial`, `TriageResult`, `Quote`, `AppealDraft` (body holds `{{Q:id}}` markers only), `GateResult`, `CaseRun` with `StepTrace` (model, tokens, cost, latency, attempts) |
| `llm.py` (extend) | A | Add `LIGHTNING`, `SUPER_VL` constants. Add `structured(model, messages, schema, *, max_tokens, step, tracker=None, thinking=None)`, which always uses the existing `llm()` |
| `budget.py` (additions only) | A | Public `price_of(model)`; image cost if the probe shows Super-VL charges per image. Caps unchanged |
| `cost.py` | A | `CostTracker`: per-step and per-case $ for the UI and eval |
| `text.py` | A | `html_to_text` (CMS fields are double-escaped), `normalize`, `locate(span, text)` → offsets in the original text |
| `cms.py` | A | `CmsCoverage` (licence token with 55-min TTL, `list_lcds` cached, `versions`, `lcd(fresh=)`, `lcd_on(lcd_id, dos)`); pure `select_version` (inclusive bounds, highest version wins on overlap). Never fetches AMA descriptors |
| `sources.py` | A | `assert_allowed(url)`: exact registered-domain block of evicore / carelon / acr.org; filters Tavily results |
| `resolver.py` | A | `resolve_policy(denial, session)`: MA/FFS via practice state → MAC → LCD config table → CMS; commercial via Tavily `search(include_domains=["aetna.com"])` + `client().extract`. Plus Tavily lookups for MA plan criteria and supporting sources (link-only) |
| `criteria.py`, `facts.py`, `match.py` | A | Lightning criteria extraction; Nano chart facts (each with a quote); Nano per-criterion match; deterministic `verdict()` |
| `appeal.py`, `citations.py` | A | Quote bank → draft → critique → revise; documentation request; gate `check(rendered, session)` |
| `pipeline.py` | A | `run_case(case_dir, routing, session) -> CaseRun`; CLI `python -m nebius_nvidia.pipeline cases/case_001` |
| `rules.py`, `intake.py`, `triage.py` | B | Deadline table; letter reading (`pypdfium2` for rasterising; **not PyMuPDF**, which is AGPL); CARC → class table (bare codes + our own labels) |
| `app/` (root) | B | Streamlit `streamlit_app.py`, `pages/`, `components.py`, `.streamlit/config.toml` |
| `jobs/drift.py` (root) | A | Nightly cron on the Lightsail server, `TOKEN_FACTORY_BUDGET_USD=0`; writes `drift_report.json` that the app reads from disk |
| `eval/` (root) | B | `make_scenarios.py`, `gen_notes.py`, `gen_letters.py`, `run_eval.py`, `score.py`, `results/` |
| `tests/` (root) | both | pytest, offline (below) |

Ideas borrowed from the deleted `policy.py`: double unescape, inclusive effective dates, highest-version-wins, newest-first walk with early stop, token TTL.

## LLM step design

| Step | Model | max_tokens | Note |
|---|---|---|---|
| Read a scanned letter | Super-VL | 4096 | Base64 PNG of pages 1–2 |
| Triage fallback | Nano | 2048 | Only when there's no CARC code |
| Policy → criteria | **Super** (was Lightning) | 16384 | Code numbers sentences; model picks ids. 7/7 gold in 3/3 runs, ~$0.01, cached per version. LCD is only ~3k tokens |
| Chart facts | Nano | 4096 | Every fact carries a quote |
| Criterion ↔ chart | Nano × N | 2048 | Given code-computed facts ("conservative care: 35 days") |
| Draft / revise | Ultra | 8192 | Can cite only quote-bank IDs |
| Reviewer critique | Super | 4096 | Plays the payer's medical reviewer |
| Synthetic notes (eval) | Super | 8192 | |

**`structured()`:**
1. The output mode for each model comes from the day-1 probe: `json_schema`, `json_object` or `prompt_only`. The schema always goes in the prompt too.
2. Parse with `model_validate_json`; if that fails, fall back to the last balanced `{…}` block.
3. Empty content → one retry with `max_tokens × 2` (capped at 32k).
4. Invalid output → one repair retry that includes the validation error.
5. Then raise `LLMFormatError`.

**Spans:** the model returns span **text**, and code finds it with `locate()`; model-provided offsets are never trusted.
- An unfound span gets one retry, then `span_verified=False`: shown with a warning and kept out of the quote bank.
- A `met` status without verified chart evidence is downgraded to `missing_documentation`.

## Citation gate
- `normalize`: remove invisible characters, map curly quotes and primes to straight ones, collapse whitespace. It stays case-sensitive and leaves dashes, ellipses and digits alone.
- A quote passes only if its normalised text is a substring of a source fetched **in this session** or of the case's chart notes. Elided ("…") quotes aren't allowed, and a letter with zero quotes fails.
- Policy quotes are rendered as block quotes with a citation line (e.g. "L34220 v40, eff 10/23/2025, CMS Coverage API").
- Precomputed cases must press **"Re-verify sources"** (a fresh fetch) before Export is enabled.
- **Tamper demo:** editing "at least four weeks" to "two weeks" in the text area turns the quote red and disables Export. difflib is used for display only.

## Rules table (`rules.py`)
Each row stores `days, clock_start, receipt_presumption, citation, source_url, verified, verified_on`. The UI shows **"Deadline unverified"** until a person checks the primary source.

| Plan type | Rule | Status |
|---|---|---|
| MA | Reconsideration, 65 days from the notice | **Verify:** CMS changed it from 60; Cornell's copy of 42 CFR 422.582 still says 60 |
| Medicare FFS | Redetermination, 120 days from receipt (presumed 5 days after the notice) | Verify against 42 CFR 405.942 |
| Commercial ACA/ERISA | Internal appeal, 180 days | Verify against 29 CFR 2560.503-1, 45 CFR 147.136 |
| Medicaid / unknown | No default | "State or plan specific; check the notice" |

Also show the caveat that contracted MA providers' payment disputes follow their contract.

## Synthetic data & eval (Bhawna)
- **Specs** (`eval/scenarios/case_NNN.yaml`): denial fields plus ground-truth `facts` (onset, conservative-care spans, red flags, prior imaging, neuro exam, surgery considered) and `expected` (criterion statuses, route, verdict). 30 cases from 7 templates with a fixed seed.
- **Letters:** templated with no LLM, then "faxed" with Pillow and watermarked SYNTHETIC.
- **Notes:** written by Super with a `fact_sentences` map. The round-trip check is **deterministic** (each sentence is a substring of its note and contains the spec value; no unexpected red flags). A failing case is regenerated at most twice, and the rate is reported.
- **The 30-case mix:**

| Group | Count | Expected outcome |
|---|---|---|
| MA, all criteria met (2 with DOS 2025-06-02 to test v37 selection) | 8 | Appeal |
| Same charts on Aetna's 6-week rule (patient at 5 weeks) | 5 | Doc request / don't appeal yet |
| MA demanded an X-ray the LCD doesn't require (OIG pattern) | 4 | Appeal |
| Red flag, early imaging | 4 | Appeal |
| MA, only 2 weeks of care | 3 | Don't appeal |
| Administrative | 3 | Fix checklist |
| Plan exclusion | 3 | Not winnable |

- **Metrics:**
  - triage accuracy;
  - per-criterion status accuracy and macro-F1;
  - verdict accuracy;
  - criteria recall against hand-labelled gold (7 L34220 v40 spans + Aetna 0236);
  - span-verification rate;
  - first-draft gate pass rate;
  - **gate catch rate on 30 auto-tampered drafts = 100%, with 0 false blocks**;
  - $ per case, latency.
- **Ablation:** ROUTED vs NANO_ONLY on the same 30 cases.

## Streamlit UI (Bhawna)
Built against a hand-written `fixtures/case_demo.json` from day 2, so it doesn't wait on the pipeline.

1. **Worklist:** deadline days-left with an "unverified" badge, reason pill, verdict, $ per case.
2. **Case / evidence board:** letter scan + extracted fields; policy card with an Altair version timeline and DOS marker; one card per criterion (verbatim span, status pill, chart quote, highlight in the note).
3. **Appeal:** tabs for draft, critique and revision; editable letter; live gate panel; Export disabled until all green; "A human reviews and sends this".
4. **Prevention check.**
5. **Policy watch:** the drift report.
6. **Sidebar:** cost meter (case $, ledger against cap, Tavily credits). `st.status` shows live step progress with model and $, which is the shot the video needs.

Polish: one theme, ~40 lines of CSS, wide layout, and the AMA attribution footer.

## Deployment (Aman)
- **App on AWS Lightsail.** Docker image (`python:3.12-slim`, `streamlit run … --server.address 0.0.0.0`).
  - Day 2: deploy hello-Streamlit to a **Lightsail container service** (micro $10/mo or small $15/mo; HTTPS URL included) and test WebSockets.
  - Fallback: **Lightsail instance small_3_0 ($12/mo, 2 GB)** running Docker + Caddy (automatic HTTPS on an sslip.io hostname). WebSockets work there.
  - Estimated ~$20–25 through Dec 15, from AWS credits.
  - Deploy with a **non-root IAM user**; the AWS connection currently uses root credentials.
- **Secrets & caps:** the keys go in as environment secrets.
  - Deployed caps: `TOKEN_FACTORY_BUDGET_USD=4`, `TAVILY_CREDIT_CAP=1200`.
  - Ledger on persistent disk (instance) or a recorded reset count (container service), so restarts × cap fit inside the reserve.
- **Access:** public mode serves 6 precomputed CaseRuns at $0. **Live mode needs a passcode**, which goes in the Devpost testing instructions. Limits: 3 live runs per session, 30 per day (SQLite counter); the ledger cap is the final stop.
- **Drift watcher = nightly cron on the Lightsail server** (LLM cap $0). It writes `drift_report.json` to the same disk the app reads.
  - Demo: a prevention case opened under v37 and scheduled after 10/23/2025 gets flagged v37→v40, with the criterion diff.

## Testing
- `tests/`, as `[dev]` extras. An autouse fixture makes **any network call fail**. Fixtures are trimmed CMS JSON for L34220 v37/v40 and its revision history.
- **Covered:**
  - `text` (unescape, normalize, `locate` offsets);
  - `versions` (2025-10-22 → v37, 2025-10-23 → v40, overlap, gaps, retired);
  - `citations` (curly quotes pass; a changed word, digit, dash or case fails; an unfetched source fails; zero quotes fails);
  - `rules`;
  - `triage` (no LLM call when a CARC code is present);
  - `structured` (fake client: newline, code fence, empty → retry, invalid → repair → error);
  - `budget` (MockTransport: over-cap refused, streaming refused, usage recorded);
  - `sources` (look-alike hosts).
- `tests/live/test_smoke.py` runs only with `RUN_LIVE=1`: L34220 by DOS (free), one Nano `structured()` call (~$0.001), one Tavily extract (1 credit).

## Schedule

| Day | Aman | Bhawna | End-of-day checkpoint |
|---|---|---|---|
| Wed 21 | `models.py` together; delete `policy.py`; `text.py`, `cms.py` + tests; `scripts/probe_models.py` (≈$0.02); `structured()`; ~~check Nebius AI Cloud access~~ (none: Token Factory only); create an AWS IAM deploy user (awaiting the user's OK) | 30 scenario specs; `rules.py` with sources; Streamlit skeleton + theme; ≤2-credit Tavily extract test (cms.gov, Aetna 0236) | pytest green; L34220 resolves by DOS; output mode known for each model |
| Thu 22 | `criteria.py` + gold criteria; `citations.py`; **hello-Streamlit on Lightsail (WebSockets test)** | `gen_notes.py` (10 cases) + `gen_letters.py`; worklist + board on the fixture | 7/7 gold criteria with 100% spans verified; hosting decided |
| Fri 23 | `facts.py`, `match.py`, `pipeline.py` CLI with trace and $ | `intake.py`, `triage.py`; all 30 cases | Demo case end to end in the CLI |
| Sat 24 | `appeal.py`, doc request, `resolver.py` (Tavily: Aetna, MA criteria, supporting sources) | UI on the real pipeline: appeal + gate + tamper demo + `st.status`; scorer on 10 cases | Gated appeal in the local UI; Aetna case → doc request |
| Sun 25 | Deploy to Lightsail; passcode + rate limit; precompute 6 cases. **Pipeline feature freeze** | First 30-case eval + failure analysis | **Public demo URL live**; first eval table |
| Mon 26 | Prevention mode; drift watcher cron on Lightsail; Policy watch page | NANO_ONLY ablation; fix the worst failure class together | Eval + ablation table; drift Job has run once |
| Tue 27 | Hardening (timeouts, 429s, error states); verify the rules on eCFR; fact-check statistics; README | Design polish; screenshots; video script | **UI freeze**; demo script runs 3× clean |
| Wed 28 | Architecture diagram; Devpost text; Token Factory feedback section; **remind the user the repo must be public** | Record and edit the video (<3 min) | Video v1; Devpost draft saved |
| Thu 29 | Final numbers in README; final redeploy; check licence detection | Final video public on YouTube | **Submitted Thursday evening PT** |

**Cut list (drop first → last):**
1. GitHub Actions cron
2. `.docx` export
3. Plan-exclusion patient letter
4. MA plan criteria via Tavily
5. Prevention as its own page (becomes a toggle)
6. Critique→revise loop
7. Drift Job
8. Super-VL (text PDFs + Nano instead)

**Never cut:** the gate, DOS versioning, the evidence board, the rules table, eval numbers, the precomputed demo, the video, a runtime Tavily call.

## Budget split (sums to the caps; reserve released only by agreement)

| Bucket | Token Factory $ | Tavily credits |
|---|---|---|
| Aman's machine (dev, precompute) | 8 | 600 |
| Bhawna's machine (data, ~4 evals + ablation, video) | 9 | 800 |
| Deployed app | 4 | 1,200 |
| Drift Job | 0 | 100 |
| Reserve | 6 | ~1,417 |

Estimated cost per routed case is ~$0.05 (NANO_ONLY ~$0.01). Check against the Token Factory dashboard daily. AWS hosting (~$20–25) is separate and comes from AWS credits.

## Top risks

| Risk | Mitigation |
|---|---|
| JSON schema not honoured | **Resolved 2026-10-21:** all five models honour json_schema (probe); fallbacks kept |
| **Lightning latency (50–230 s per call)** | **Resolved:** criteria extraction moved to Super (7/7 gold, 3/3 runs); Lightning not on any request path |
| Empty content from reasoning | Retry with doubled tokens; turn thinking off for extraction if supported |
| WebSockets on the host | Day-2 test; Lightsail instance + Caddy fallback |
| No Nebius AI Cloud credits | **Happened:** the drift watcher runs as cron on Lightsail; Token Factory alone meets the 'runs on Nebius' rule |
| Eval grading itself | The spec is ground truth; the round-trip check is deterministic |
| CMS down during the demo | Precomputed mode; export stays blocked until re-verify works (by design) |
| Video carries the submission | Script Tue 27, record Wed 28 |

## Step 0 once approved (before any code)
- Update `docs/plan.md` to this plan.
- Update CLAUDE.md: Aetna instead of UHC, AWS hosting, passcode demo, test commands.
- Add `[dev]` (pytest) and `[app]` (streamlit, altair, pypdfium2, pillow, pyyaml) extras to `pyproject.toml`.

## Verification
- **Every commit:** `./.venv/bin/pip install -e .[dev] && ./.venv/bin/pytest` (offline, $0).
- **Daily:** `RUN_LIVE=1 ./.venv/bin/pytest tests/live`. Check `spent_usd()` and `tavily_credits_used()` against the budget split.
- **Pipeline:** `python -m nebius_nvidia.pipeline cases/case_demo` prints the verdict, evidence board, gate result and $ per case.
  - Demo MA case → appeal citing L34220 v40.
  - The same chart on Aetna → doc request.
  - A DOS 2025-06-02 case → v37.
- **Eval:** `python eval/run_eval.py --routing routed` and `--routing nano_only` write `eval/results/*.json` and a markdown table. Pass bars: gate catch rate 100% with 0 false blocks; criteria recall 7/7 on L34220.
- **Deployed:** open the Lightsail URL in a private browser window.
  - Precomputed cases load at $0.
  - Tamper demo blocks Export.
  - The passcode run completes and the meter updates.
  - The 4th live run in a session is refused.
- **Pre-submit (Oct 29):** licence detected on GitHub; repo public (**only after the user says so**); video under 3 min on YouTube; Devpost fields match the `docs/brief.md` checklist.

## Status at end of Wed Oct 21

**Done (all on `main`, private repo):**
- Day 1–2 foundations: `models`, `cms` (version by DOS), `text` (normalize/locate/segment), `sources`, `rules` (eCFR-verified), `structured()` with retries, budget fixes (`prices()`, ledger flush race fixed and ledger reconciled to $0.60).
- Criteria extraction: sentence-pick design; **Super, 7/7 gold in 3/3 runs**; first_words realignment; record-keeping and post-scan report rules skipped.
- Citation gate + appeal writer (quote bank → Ultra → Super critique → Ultra revise) + templated documentation requests. Typed quotes and unknown markers are blocked (tested).
- Intake 6/6 on scans (Super-VL ~6 s) and text (Nano 0.7 s); CARC triage.
- 30 synthetic cases committed (scenarios, Super-written notes with deterministic checks, fictional faxed letters).
- Eval runner with gold scoring and `--rescore`. 82 offline tests pass.
- AWS deploy profile `aman-deploy` (Lightsail-only IAM user). No Nebius AI Cloud credits: drift watcher → Lightsail cron.

**Open problem (top priority Thu):** criterion **matching** quality. Pilot (5 cases, Nano matcher, after gold-label fix): triage 5/5, **verdict 1/5**, gold statuses 20/35. Errors: no-red-flag patients get the red-flag list as `not_met` (should be `not_applicable`); first-month and findings-affect-treatment rules judged wrongly. A single `not_met` flips the verdict to `dont_appeal`. Super matcher pilot: `eval/results/pilot_super.md` (was still running at wrap-up). Options, in order:
1. Matcher prompt: state the applies-when logic explicitly per criterion (red-flag rules → n/a without red flags; exceptions satisfied by red flags), and give the model the facts summary first.
2. Use Super (or Ultra) for matching if it's clearly better; cost per case stays well under $0.10.
3. Pre-classify applicability in code from `Criterion.applies_when` + computed facts before calling the model.

**Not started:** Aetna resolver via Tavily (group B), Streamlit UI, Lightsail deploy + WebSocket test, prevention mode, drift cron, eval on all 30 + ablation, video, Devpost write-up.

**Spend:** Token Factory ≈ $0.75 of $27 (plus the Super pilot still running) (see `.token_factory_spend.json`; check the dashboard); Tavily 8 of 4,125 credits.
