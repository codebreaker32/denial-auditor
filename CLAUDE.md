# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

Early-stage Python project for the Nebius x NVIDIA Global AI Hackathon (https://nebiusglobalaihackathon.devpost.com/). It has two integrations: Nemotron models through Nebius Token Factory (`llm.py`) and Tavily live web access (`web.py`). Toloka and Tandem were deliberately left out.

**Chosen product: Denial Auditor (Best Apps & Agents track).** Its users are billers at small medical practices, and it handles health-insurance denials for outpatient MRI/CT imaging. It triages denials by winnability, splits the payer's live policy into criteria, and matches each criterion against chart evidence; missing evidence becomes a documentation request to the physician. It drafts an appeal with citations that must match fetched text exactly, and it cites the policy version in effect on the date of service. Prevention (checking a prior-auth request before submission) is the secondary mode. See `docs/track-decision.md` for why, and `docs/brief.md` for the rules checklist. Product invariants:
- Only synthetic patient data. No real PHI anywhere, including the repo, demo and video.
- An appeal can't be exported unless every quoted policy line exactly matches text fetched in that session.
- Deadlines come from a fixed rules table, never from the LLM.
- A human always sends the appeal; the tool never submits anything.
- Never claim inputs are "never trained on" until Token Factory's data terms are verified.
- Policy sources: the CMS Coverage API is primary (versioned by effective date; licence token accepted by the user for personal, non-commercial use). The commercial payer is **Aetna CPB 0236** (HTML, a snapshot at fetch time). **UHC was dropped**, because its imaging criteria are eviCore text. **Never send eviCore, Carelon or ACR text to a model or store it**, because their terms forbid it; link to them by name only (`sources.assert_allowed`).
- Hosting: the Streamlit app runs on **AWS Lightsail** (deploy with AWS CLI profile **`aman-deploy`**: IAM user `denial-auditor-deploy`, Lightsail + read-only cost access only, region `us-east-1`; profile `aman` is the root account, so use it only for account admin). The policy-change (drift) watcher runs as a **nightly cron job on the same Lightsail server**, with an LLM cap of $0. There are no Nebius AI Cloud credits (Token Factory only), so nothing runs on Nebius Serverless. The public demo serves precomputed cases; live runs need a passcode and are rate-limited.
- CPT: show bare codes only, never the AMA descriptors, and include the AMA attribution line.
- The build plan and day-by-day schedule are in `docs/plan.md`.

**Implementation was approved on 2026-10-20 against `docs/plan.md`** (user rule: no implementation without the user's go-ahead). Stay within the plan; ask before any change to scope, product, hosting or budget. **Keep working through the plan without stopping for check-ins until the user says "wrap up"** (user rule); still ask before decisions that need them. **At every wrap-up, shut down everything that costs money** (user rule): delete the Lightsail container service or instance (Lightsail bills stopped and disabled resources until they're deleted; `scripts/deploy.sh down`), stop local servers and background jobs, and confirm with `aws lightsail get-container-services --profile aman-deploy` that nothing is left running.

**Repo:** github.com/codebreaker32/denial-auditor. Team **Fine Print**: Aman Bihari, Bhawna. **Keep the repo PRIVATE until the user explicitly says to make it public** (user rule). The hackathon requires a public repo at submission, so remind the user before the deadline, but never change the visibility yourself.

Hard requirements from the official rules (failing any of these fails the pass/fail Stage One check):
- The project must make a **runtime call to the Nebius Token Factory inference API**, or be deployed on Nebius AI Cloud (Serverless Jobs, Serverless Endpoints or DevPods).
- It must use **at least one NVIDIA open source model** (e.g. Nemotron 3 Nano / Super / Ultra).
- It must fit one track: Coding & Agentic Engineering, Best Apps & Agents, Personal AI, or Physical AI.
- The repo must be public and include an OSI license file (MIT / Apache 2.0) that GitHub can detect. It also needs a working demo URL and setup instructions.
- The Tavily call must happen at **runtime** in the shipped app to qualify for the "Best Use of Tavily" bonus prize.

Deadline: **Oct 30, 2026, 10:00 am PT.** Stage Two judging weighs four criteria equally: technological implementation, design (a complete product, not just a proof of concept), potential impact, and quality of the idea.

## Commands

```bash
python3 -m venv .venv
./.venv/bin/pip install -e .           # editable install (hatchling, src layout)
cp .env.example .env                    # then set TAVILY_API_KEY and NEBIUS_TOKEN_FACTORY_KEY
./.venv/bin/pip install -e '.[dev]'    # adds pytest
./.venv/bin/pytest                      # offline unit tests: any network call fails the test
./.venv/bin/pytest tests/test_cms.py::test_name   # a single test
RUN_LIVE=1 ./.venv/bin/pytest tests/live          # opt-in live checks (costs ~$0.001 + 1 Tavily credit)
./.venv/bin/python smoke_test.py        # one live Tavily search + one Nemotron call

# Pipeline and eval (live; cost cents per case)
./.venv/bin/python -m nebius_nvidia.pipeline cases/case_001 [--text] [--no-appeal]   # evidence board + appeal + gate
./.venv/bin/python eval/run_eval.py --matcher nano|super --groups A,C,D,E --text --tag NAME   # writes eval/results/NAME.{json,md}
./.venv/bin/python eval/run_eval.py --rescore NAME        # re-score a saved run against current scenarios ($0)
./.venv/bin/python scripts/check_criteria.py nvidia/nemotron-3-super-120b-a12b   # criteria recall vs eval/gold
# Synthetic data (cases/ is committed): make_scenarios.py ($0, deterministic) → gen_notes.py (Super, ~$0.01/case) → gen_letters.py ($0)
```

There's no linter or formatter yet. Live checks and `smoke_test.py` spend real credits.

## Architecture

- Package is `src/nebius_nvidia/` (src layout; `pyproject.toml` lists the wheel packages explicitly). The public API is re-exported from `__init__.py`: `llm`, `chat`, `NANO`/`SUPER`/`ULTRA` (from `llm.py`) and `client`, `search` (from `web.py`).
- `llm.py` uses the `openai` SDK pointed at `https://api.tokenfactory.nebius.com/v1/`, the OpenAI-compatible Token Factory API. `llm()` is a cached client, the same pattern as `client()`. Model IDs are case-sensitive and not consistently formatted; list them with `GET /v1/models`. Nemotron 3 models are reasoning models: the reasoning trace comes back in `message.reasoning`, `content` has a leading newline, and `content` can occasionally be empty. `chat()` strips the text and raises when the content is empty. Give it a generous `max_tokens`.
- `web.py` loads `.env.local` and then `.env` **at import time**. `python-dotenv` doesn't override variables that are already set, so the precedence is: real environment > `.env.local` > `.env`. Because these paths are relative to the current working directory, run scripts from the repo root.
- `client()` is wrapped in `lru_cache(maxsize=1)`: one shared `TavilyClient` per process. It raises `RuntimeError` when `TAVILY_API_KEY` is unset. Changing the key after the first call has no effect unless you call `client.cache_clear()`.
- **Spend caps (user requirement, don't remove):** Token Factory is capped at $27 for the entire project, and Tavily at 4,125 credits (7 credits had already been used before the ledger existed). Both are enforced in `budget.py`. `llm()` routes every request through `BudgetTransport`, a custom httpx transport. `client()` returns a `GuardedTavily` wrapper. Before each call, the code checks the worst-case cost against the cap and raises `BudgetExceeded` if the call could go over. After the call, it records the actual cost in gitignored JSON ledgers (`.token_factory_spend.json`, `.tavily_spend.json`). Never call `OpenAI(...)` or `TavilyClient()` directly, because that bypasses the caps. Rules that follow from the guard: Token Factory streaming is refused, and Tavily methods must take keyword arguments. The ledgers are per-machine files, so a deployed app (e.g. on Nebius Serverless) gets its own fresh ledger unless the ledger moves to shared storage. The caps can be overridden with the `TOKEN_FACTORY_BUDGET_USD` / `TAVILY_CREDIT_CAP` env vars.
- **LLM steps use `structured(model, messages, Schema, max_tokens=, step=, tracker=)`** in `llm.py`, which returns a validated pydantic model. Probe results (`scripts/probe_models.py`, 2026-10-21): all five Nemotron models honour `response_format` json_schema; Nano with `thinking=False` is ~10× faster and cheaper (0.4 s vs 4.2 s), so use it for simple extraction; **Lightning takes 50–230 s even for small prompts and is not used on any request path**; images cost $0 on Super-VL. Criteria extraction uses **Super** (7/7 gold criteria in 3/3 runs; see `criteria.py`): code numbers the policy's sentences and the model only picks sentence ids, so spans are cut from the source.
- Policy text and model spans: models return span *text* only; code verifies it with `text.locate()` against the fetched `PolicyDoc.text` and never trusts model offsets.
- **Pipeline** (`pipeline.run_case`): `intake` (Super-VL reads `letter.png`, or Nano with thinking off reads `letter.txt`) → `triage` (CARC table; Nano only without a code) → `resolve_policy` (MA/FFS: practice state → Noridian L34220 via `cms.lcd_on(dos)`; commercial/Aetna not wired yet) → `criteria.extract_criteria` (cached) → `facts.extract_facts` (quotes verified; durations computed in code) → `match.match_all` (one LLM call per criterion; evidence verified; `met` without evidence → `missing_documentation`) → `match.verdict` (fixed rule) → `appeal.draft_appeal` (quote bank → Ultra draft → Super critique → Ultra revise → `render` → `citations.check`) or `appeal.documentation_request` (template). Deadlines use `pipeline.review_date` (notice + 7 days) so synthetic cases stay meaningful.
- **Synthetic cases** live in `cases/case_NNN/` (`scenario.json` ground truth, `notes.json`, `letter.txt`, `letter.png`). `scenario.Expected.gold` is keyed by the gold anchor ids in `eval/gold/L34220_v40.json`, not by extracted criterion ids (those vary run to run). Convention: an exclusion that doesn't describe the case is `not_applicable`, not `met`.
- `search()` is a thin pass-through that returns Tavily's raw response dict (`response["results"]`, each with `title`/`url`). For other operations (`extract`, `crawl`, `map`, `research`), call `client()` directly instead of adding a wrapper for each one.
- Secrets: `.env`, `.env.local` and `.env.*.local` are gitignored. `.env.example` is the committed template. Never log or hardcode the key (this is also stated in the `web.py` docstring).
