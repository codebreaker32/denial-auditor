# Denial Auditor

> Payers check your MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same.

Denial Auditor helps billing staff at small medical practices work health-insurance denials for outpatient **MRI and CT imaging**. It:

- **triages** each denial by whether it can be won (administrative fix, plan exclusion, or clinical);
- fetches the payer's **live coverage policy**, choosing the version in effect on the date of service;
- splits the policy into numbered criteria and **matches each one to the exact sentence in the chart**;
- turns missing evidence into a **documentation request** to the physician;
- drafts an appeal whose **every quoted policy line is verified** against the fetched source text before it can be exported.

A second mode runs the same checks on a prior-authorization request **before** it's submitted.

Built for the [Nebius x NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/), **Best Apps & Agents** track, by team **Fine Print**: Aman Bihari and Bhawna.

> 🚧 In active development (Oct 20–30, 2026). See [docs/plan.md](docs/plan.md) for the build plan.

## How it uses Nemotron, Token Factory and Tavily

| Step | Model / service |
|---|---|
| Read a scanned denial letter | Nemotron 3.5 Super-VL (Token Factory) |
| Extract codes and dates; triage; check each criterion against the chart | Nemotron 3 Nano (Token Factory) |
| Pick the policy sentences that state each coverage criterion (spans cut from the source by code) | Nemotron 3 Super (Token Factory) |
| Draft the appeal, then critique it as the payer's reviewer and revise | Nemotron 3 Ultra / Super (Token Factory) |
| Find and extract payer policies and supporting sources at runtime | Tavily search / extract / map |
| Versioned Medicare coverage policies (LCDs) | CMS Coverage API |
| Nightly policy-change watcher | Cron on the app server (no LLM) |

## Setup

```bash
python3 -m venv .venv
./.venv/bin/pip install -e .
cp .env.example .env   # add TAVILY_API_KEY and NEBIUS_TOKEN_FACTORY_KEY
./.venv/bin/python smoke_test.py
```

`smoke_test.py` makes one live Tavily search and one Nemotron call. Spending is hard-capped in code (see `src/nebius_nvidia/budget.py`); override the caps with `TOKEN_FACTORY_BUDGET_USD` and `TAVILY_CREDIT_CAP`.

## Important notices

- **Synthetic data only.** No real patient information is used anywhere in this repository, the demo or the video.
- **Decision support, not advice.** Denial Auditor helps billing staff prepare appeals. It is not legal or medical advice, and a human always reviews and sends the appeal. The tool never submits anything.
- **CPT®** codes are shown as bare codes only. CPT is a registered trademark of the American Medical Association; CPT descriptors are © American Medical Association, all rights reserved. Retrieving full LCD text through the CMS Coverage API requires accepting the AMA CPT license for personal, non-commercial use.
- Payer policies are fetched live from their public sources and quoted briefly with attribution, a link and the effective date. They are not redistributed. eviCore, Carelon and ACR Appropriateness Criteria content is linked by name only, because their terms prohibit reuse.

## License

[Apache-2.0](LICENSE)
