# Concepts (12): three per track

The statistics are from the Phase 1 research and remain **unverified until the fact-check**. Team: 2–4 people, strong in Python and ML, little frontend experience; they have a phone camera and an A100 container. Constraints: 10 days, $27 of Token Factory, ~4,100 Tavily credits. Every concept calls Nemotron on Token Factory at runtime and uses Tavily at runtime.

---

## Coding & Agentic Engineering

### C1: ProofGate *(institution-side: OSS maintainers)*
- **One-liner:** before a maintainer reads an incoming bug or security report, an agent tries to reproduce it in an isolated Token Factory Sandbox. It attaches a failing test, or marks the report "could not reproduce", with a full log.
- **Problem:** AI-generated junk reports are overwhelming maintainers; curl closed its bug bounty over them. Only 33% of developers trust AI output (Stack Overflow 2025).
- **Owner:** the project maintainer, through a GitHub App or Action on new issues.
- **Logic:** Nano triages the report → Tavily pulls any referenced CVE or advisory and the upstream docs → Super writes a reproduction script → Sandbox runs it, branching into parallel attempts → Ultra decides only when the evidence conflicts. **The agent never closes an issue.** It labels and attaches evidence, and a human decides.
- **MVP:** a CLI/Action plus a web report page; the demo runs on 10 real historical issues from a public repo (some valid, some invalid).
- **Eval:** reproduction accuracy on a labelled set of ~30 past issues.

### C2: UpgradeBisect *(user-side: application developers)*
- **One-liner:** "upgrade X from v2 to v4" → Tavily pulls changelogs and migration guides, the agent branches a sandbox per intermediate version, runs the test suite, finds the breaking change, and opens a PR with the fix and a link to the changelog line that caused it.
- **Problem:** dependency upgrades are tedious and get skipped, which leaves known vulnerabilities in place.
- **Logic:** Tavily (changelogs) → Super plans the version path → parallel Sandbox branches run tests → Nano reads the failures → Ultra writes the fix on the hardest break.
- **MVP:** 3 demo repos (e.g. pydantic v1→v2, SQLAlchemy 1.4→2.0).
- **Tavily angle:** strong. It depends on live, version-specific documentation.

### C3: Cascade Bench *(contrarian: cost as the product)*
- **One-liner:** a coding-agent runner that tries Nano first in parallel sandbox branches and escalates to Super, then Ultra, only on test failure. It publishes the cost/accuracy curve on a SWE-bench subset.
- **Pitch:** it proves the track's own advice ("let Nano or Super handle the fast calls") with measured data.
- **MVP:** runner + dashboard + an eval on 50 SWE-bench Verified tasks.
- **Weakness:** the app is less product-like, and its Tavily use is thin.

---

## Best Apps & Agents

### A1: ClaimBack *(institution-side: patient advocates and clinic billing staff)*
- **One-liner:** upload a health insurance denial letter and get an appeal letter citing the insurer's own current policy and the state's appeal rules, with a deadline tracker.
- **Problem:** insurers denied 19% of in-network ACA marketplace claims in 2023, and fewer than 1% of denials were appealed (KFF).
- **Logic:** Super-VL reads the scanned letter → Nano extracts codes, dates and the denial reason → Tavily pulls the insurer's medical policy and state external-review rules → Ultra drafts the appeal → Super critiques it from the insurer's side, and the draft is revised. Every citation links to a source URL. **A human sends it.**
- **Privacy:** personal details are redacted before any call; a synthetic demo letter is used.
- **Risks:** health/legal liability, citation hallucination, HIPAA framing.

### A2: AccessFix *(user-side: small online shops)*
- **One-liner:** enter your shop URL and get a WCAG audit ranked by legal risk, plus **actual fixes**: generated alt text, contrast fixes and ARIA patches as a downloadable patch or Shopify-ready snippets. A weekly re-crawl runs as a Nebius Serverless Job.
- **Problem:** 95.9% of the top 1M home pages fail WCAG (WebAIM 2026); 3,117 web accessibility lawsuits in 2025 (Seyfarth, secondary). The FTC fined accessiBe $1M for false "AI compliance" claims.
- **Logic:** Tavily crawl/map → axe-core rule checks (deterministic) → Super-VL judges screenshots for issues rules can't catch (meaningful alt text, visual order) → Nano writes the fixes → Ultra writes the prioritised summary. **It never claims "compliant"**, because that's the claim the FTC fined accessiBe for.
- **Design note:** the before/after comparison works well in a video.

### A3: Council Lens *(contrarian: news deserts)*
- **One-liner:** for towns with no local newspaper, an agent watches council agendas and minutes, finds decisions that affect residents (rezoning, budgets, school closures) and sends a plain-language weekly brief with links to the source documents.
- **Problem:** 213 US counties have no local news outlet (Medill).
- **Logic:** Tavily crawls the council site → Lightning (1M context) reads long PDFs → Super extracts decisions → Ultra rates resident impact → a Serverless Job runs it weekly.
- **Risks:** PDF/site variety; impact is harder to show in 3 minutes.

---

## Personal AI

### P1: Clawguard *(institution-side: agent security for any personal agent)*
- **One-liner:** a quarantine and permissions layer for personal agents. Every skill is statically reviewed by Nemotron for ClawHavoc patterns before install; a least-privilege OpenShell policy is generated for it; new outbound access is approved from your phone; untrusted content (email, web) goes to a Nano "reader" that has no tools.
- **Problem:** 341 of 2,857 ClawHub skills were malicious (Koi Security, Feb 2026); 40,214 OpenClaw instances are exposed to the internet (SecurityScorecard).
- **Logic:** Super reviews the skill code and docs → Tavily checks the publisher, the package and known-malware reports → a policy is generated → OpenShell enforces it. The demo installs a ClawHavoc-style skill and shows it blocked, then shows a prompt injection in an email failing.
- **Risks:** NemoClaw/OpenShell are alpha and WSL2 support is experimental; it's more a security tool than an "assistant".

### P2: CareCircle *(user-side: family caregivers)*
- **One-liner:** a private assistant for someone caring for an elderly parent. It reads discharge papers and prescriptions (Super-VL), keeps a medication and appointment memory, answers "can Mum take ibuprofen with her new meds?" with sources, and **watches the FDA for recalls and safety alerts on her exact drugs** (Tavily, on a schedule). It runs in a NemoClaw/OpenShell sandbox with Telegram as the channel.
- **Problem:** 63M US family caregivers (AARP 2025).
- **Privacy:** memory is stored locally in Markdown that the user owns; names and IDs are pseudonymised before Token Factory calls; delete-on-request.
- **Risks:** medical advice liability (it cites and refers, it doesn't advise); a crowded "assistant with memory" pattern.

### P3: Masked *(contrarian: privacy routing)*
- **One-liner:** a personal agent where personal data never reaches the cloud model in the clear. A local pseudonymiser replaces names, numbers and addresses with tokens before each call and restores them on the way back; a visible ledger shows every outbound call and what it contained.
- **Logic:** a local NER/regex step (or a Nano instance on the A100) → Token Factory Super/Ultra → re-identification → a ledger UI.
- **Weakness:** the infrastructure is hard to make vivid in a video, and the "assistant" part is generic.

---

## Physical AI

### X1: LongLie *(institution-side: care homes / assisted living)*
- **One-liner:** a phone camera in a resident's room. It isn't another fall detector: it targets the **"long lie"** (30% of over-90s who fall stay on the floor for an hour or more, BMJ). On a suspected fall, the agent does a voice check-in ("Are you OK? Say yes or raise your hand"), escalates to staff with a short clip if there's no answer, and logs it.
- **Logic:** frame sampling → Nemotron Super-VL on Token Factory → on a flag, Cosmos Reason 2 on the A100 gives a second opinion → the agent acts (voice, alert). **It never acts on one signal alone.** A Serverless Job generates rare synthetic fall scenarios with Cosmos and reports precision/recall.
- **Risks:** fall detection is the most crowded Physical AI idea; camera privacy in bedrooms; a staged demo.

### X2: HomeSafe Walkthrough *(user-side: older adults and families)*
- **One-liner:** walk through a home with your phone for 2 minutes and get an occupational-therapist-style fall-hazard report: loose rugs, missing grab rails, poor lighting, cables. Each item is timestamped in the video, with a fix and an approximate cost.
- **Problem:** 14M+ US adults 65+ fall each year (CDC); 43,020 fall deaths among people 65+ in 2024 (NSC).
- **Logic:** video → keyframes → Super-VL → Cosmos Reason 2 (A100) checks the spatial reasoning → Tavily pulls current product prices and local home-modification programs → Ultra writes a prioritised report.
- **Privacy:** one-off and user-initiated; no always-on camera; video is deleted after the report.
- **Risks:** "hardware" is just a phone; may look like an app rather than an embodied agent.

### X3: HazardForge *(contrarian: a crash-test for vision agents)*
- **One-liner:** a Nebius Serverless Jobs pipeline that uses Cosmos to generate rare, dangerous scenarios (falls, fires, a child near a pool) and scores any vision safety agent on them: a public leaderboard plus a reusable eval set.
- **Pitch:** most Physical AI entries will have no evaluation; this sells the evaluation itself.
- **Risks:** Cosmos Predict needs an 80GB-class GPU (the A100 80GB may work); generation is slow (~229 s per 5-second clip on an H100); it's the furthest from an "end-user product".
