# Track and idea decision

Status: **Decided (2026-10-20): Denial Auditor, Best Apps & Agents track.** Deadline: Oct 30, 10:00 am PT.

Team decisions:
- **User:** billing staff at small practices (2–10 physicians).
- **Specialty:** outpatient **MRI/CT imaging** denials (medical necessity / prior auth).
- **Scope:** **appeals** are the core product. **Prevention** (checking a prior-auth request against the policy before it's submitted) is the closing feature, built on the same engine.
- **Research in progress:** provider-side competitors (`docs/research/competitors.md`) and imaging policy and data sources (`docs/research/data-sources.md`).

Method: four research agents (one per track) → 12 concepts ([concepts.md](concepts.md)) → four simulated judges scored all 12 side by side → the top three by average were red-teamed by hostile reviewers who checked the key assumptions on the live web. The competition-landscape research was still running when judging happened, so its findings aren't reflected here.

## Judge scores (out of 100)

| Concept | Track | Official | Technical | Strategist | Resp. AI | **Mean** | Spread | Tavily fit | Buildable |
|---|---|---|---|---|---|---|---|---|---|
| C1 ProofGate | Coding | 80 | 84 | 78 | 84 | **81.5** | 6 | 5 | 6 |
| A1 ClaimBack | Apps | 81 | 83 | 75 | 73 | **78.0** | 10 | 9 | 7 |
| P1 Clawguard | Personal | 74 | 79 | 80 | 78 | **77.8** | 6 | 5 | 4 |
| A2 AccessFix | Apps | 74 | 77 | 74 | 81 | 76.5 | 7 | 6 | 7 |
| X2 HomeSafe | Physical | 70 | 74 | 81 | 72 | 74.2 | 11 | 6 | 8 |
| C2 UpgradeBisect | Coding | 71 | 80 | 70 | 69 | 72.5 | 11 | 8 | 7 |
| A3 Council Lens | Apps | 72 | 72 | 62 | 75 | 70.2 | 13 | 7 | 6 |
| P2 CareCircle | Personal | 76 | 76 | 67 | 58 | 69.2 | 18 | 6 | 6 |
| X1 LongLie | Physical | 72 | 73 | 77 | 48 | 67.5 | **29** | 2 | 5 |
| X3 HazardForge | Physical | 59 | 66 | 67 | 60 | 63.0 | 8 | 1 | 3 |
| C3 Cascade Bench | Coding | 63 | 61 | 57 | 58 | 59.8 | 6 | 2 | 7 |
| P3 Masked | Personal | 55 | 57 | 53 | 72 | 59.2 | 19 | 2 | 7 |

(Tavily fit and buildability are the technical judge's ratings, out of 10.)

**Track verdicts:**
- **Physical AI:** the judges split. The strategist ranked it best for odds, because it's the least crowded (~60–250 entries, an unverified estimate). The official judge rated HomeSafe a high Stage-One risk, because it doesn't act in the real world. A phone-only entry also faces NVIDIA robotics judges.
- **Personal AI:** crowded. Nebius's own June webinar demonstrated NemoClaw + Token Factory + Tavily + Slack, so many entries will copy it.
- **Coding:** strong sponsor fit through Token Factory Sandboxes, but crowded overall.
- **Apps:** the widest track and the most entries, but also the most room to pick a specific problem.

**Ruled out:**
- X1 LongLie: bedroom cameras for residents who may not be able to consent (responsible-AI score 48).
- P2 CareCircle: drug-interaction answers amount to practising medicine.
- P3 Masked and C3 Cascade Bench: the infrastructure and benchmark are hard to film, and Tavily barely fits.

## Red-team results: none of the top three survives as written

### C1 ProofGate
- **Fatal unless resolved:** Token Factory Sandboxes is a **request-access Beta** with no approval timeline (https://docs.tokenfactory.nebius.com/sandboxes/overview). It has no published pricing, a limit of 50 concurrent operations, and the SDK is `contree-sdk` (pre-alpha).
- **Major:** close prior art exists. Metabase Repro-Bot (open source, Mar 2026) reproduces an issue and writes a failing test. Elastic has a HackerOne triage agent. Research benchmarks exist for turning issues into reproduction tests (SWT-bench, TDD-Bench).
- **Major:** setting up arbitrary repo environments isn't feasible in 10 days. Using the 7,000+ preloaded SWE-rebench images is.
- **Minor/major:** the Tavily use isn't essential; a CLI demo hurts the Design score; sandbox networking is on by default.

### A1 ClaimBack
- **Statistic corrected:** 19% is KFF's **2024** figure (2023 was 20%). "Fewer than 1% appealed" holds.
- **Major:** the approach misses most denials. Only 5% of 2024 denial reasons were medical necessity and 9% prior auth/referral; 25% were administrative, 13% excluded services and 36% "other".
- **Major:** the space is crowded and obvious. Counterforce Health (free, cites guidelines and regulations), Fight Health Insurance (free, all 50 states, has a version for practices), Claimable, Sheer Health, and at least 5 earlier hackathon clones.
- **Major:** linking a URL doesn't prove the citation is real. Deadlines depend on plan type, not just state rules.
- **Holds up:** UHC, Aetna and Cigna medical policies are publicly fetchable, and HealthCare.gov publishes the external-review rules. Token Factory offers a BAA (chat/completions, with Zero Data Retention on).

### P1 Clawguard
- **Fatal:** NVIDIA already ships two of its four pillars. **SkillSpector** is NVIDIA's open-source skill scanner, and **OpenShell Policy Advisor** already handles human-approved egress rules.
- **Major:** the market is crowded (ClawHub's VirusTotal scanning, Cisco, Koi, Socket, Snyk), and Trail of Bits bypassed every skill scanner it tested in June 2026.
- **Major:** the track fit is weak. It's a security layer, not an assistant.
- **Major:** OpenShell on WSL2 is experimental, and it wants Linux 6.2+ Landlock. The team's kernel is 5.15. Both NemoClaw and OpenShell are alpha.

## Refined finalists

### Finalist 1: Denial Auditor (refined from ClaimBack) · Best Apps & Agents
**For clinic billing teams: it finds which clinical denials can be won, and proves every citation.**
- **Repositioned** from consumers (crowded, free competitors) to the **provider side**: small practices' billing staff working clinical denials (medical necessity, prior auth) from UHC, Aetna and Cigna.
- **Flow:**
  1. Super-VL reads the denial.
  2. Nano **triages by denial reason** and routes administrative denials to a plain checklist instead of an LLM appeal.
  3. Tavily fetches the insurer's **current** medical policy, and Lightning (1M context) splits it into numbered criteria.
  4. Nano checks each criterion against the (synthetic) chart notes.
  5. Ultra drafts the appeal.
- **Main technical feature: a citation-verification gate.** Export is blocked unless every quoted policy line exactly matches text fetched in that session.
- **Policy-drift watcher:** a nightly Nebius Serverless Job re-fetches the policies and flags changes that affect open cases.
- Deadlines come from a fixed rules table (by plan type), never from the LLM.
- **Eval:** 30 synthetic cases, measuring citation precision and criterion-match accuracy.
- **Why it can win:** it has the best Tavily-prize fit of all 12 concepts (9/10), so it competes for the track win and the Tavily bonus at once. It has no access gate and is the most buildable. It uses each model for a distinct step, plus a Serverless Job.
- **Risks:** it stays in the most crowded track; it's a health/legal domain (synthetic data only, plus a disclaimer); insurer PDFs are large (0.4–1.5MB) and Aetna has a click-through terms page.

### Finalist 2: ProofGate (narrowed) · Coding & Agentic Engineering
**For OSS maintainers: no bug report reaches a human until an agent has tried to reproduce it in a branching sandbox.**
- Scope: **Python repos on SWE-rebench preloaded images**. One Sandbox checkpoint branch per reproduction hypothesis; PoC code runs with networking **off**.
- Tavily does the "duplicate / already fixed upstream / matching advisory" check.
- Output: a GitHub App comment, plus a **branch-tree report page** that shows each attempt.
- **Eval:** 20 valid reports (labelled for free by the gold patch, which fails before the fix and passes after) and 15 invalid or AI-slop reports.
- **Why it can win:** it had the highest and most consistent judge scores (81.5, spread 6) and the cleanest privacy profile. It uses a new Nebius product the way it was designed, which is what Nebius PMs want to feature, and the problem is timely (curl ended its bug bounty because of AI-generated junk reports).
- **Risks:** **it depends on Sandbox access being approved**, so request it today and decide go/no-go within 48h. Metabase Repro-Bot caps the "Idea" score. Its Tavily-prize fit is moderate. Budget: about $10–15 per eval run, so development should use Nano/Lightning and the A100.

### Finalist 3: Contained (refined from Clawguard) · Personal AI
**A useful personal assistant (NemoClaw + Hermes on Telegram) whose selling point is containment, not detection.**
- Before a skill is installed, Nemotron writes a **default-deny OpenShell policy** for it, using NVIDIA SkillSpector findings as an input.
- Policy Advisor approval requests arrive as **Telegram cards**.
- A **tool-less Nano "reader"** handles all untrusted email and Tavily web content and returns only structured JSON.
- Daily tasks are real: an inbox digest and research briefs.
- **Demo:** an obfuscated skill **slips past the scanner but is blocked at runtime**, shown split-screen against an unprotected agent that leaks keys.
- **Why it can win:** the most memorable demo, and the deepest use of NVIDIA's own Personal AI tools. Those tools are exactly what the track names, and the judges include the teams behind them.
- **Risks (highest of the three):** alpha tools, OpenShell enforcement on a 5.15 WSL2 kernel (test on day 1; the fallback is a Nebius VM with a 6.x kernel), a crowded track, and the lowest buildability score (4/10).

## Recommendation

**Denial Auditor**, with **ProofGate as the alternative if Sandbox access is approved within 48 hours.**

- Denial Auditor has no external gate. It's the most buildable for a Python/ML team, plays to their eval and data strengths (criteria matching, citation precision), and is the strongest contender for the Tavily bonus.
- ProofGate scored highest with the judges but depends on a beta access approval we don't control.
- Contained has the best demo but the most ways to fail before day 3.

## Open items before building
- [ ] Request Token Factory Sandboxes access (keeps ProofGate open).
- [ ] Verify Token Factory's data-retention and training terms before making any privacy claim.
- [ ] Re-verify every statistic in Phase 2 (the KFF year has already been corrected).
- [ ] Verify the claim that Nebius owns Tavily (from secondary research) before repeating it.
