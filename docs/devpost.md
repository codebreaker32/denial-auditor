# Devpost submission: Denial Auditor

Final copy, ready to paste field by field. Updated 2026-10-28.
Rules for editing: every number here appears in the Fact register at the end, with its source. Statistics come only from `docs/facts.md`. Don't add a number that isn't in the register.

---

## Project name

Denial Auditor

## Tagline (Devpost "elevator pitch", max 200 characters)

Checks a denied MRI claim against the payer's policy for the date of service, verifies every quote word for word, and tells a small practice's biller whether to appeal.

(168 characters.)

## Track

Best Apps & Agents

## Team

Road House: Aman Bihari, Bhawna.

---

## Inspiration

Most denials that get appealed are overturned, but few are appealed. In Medicare Advantage in 2024, only 11.5% of denied prior-auth requests were appealed, and 80.7% of those appeals were partly or fully overturned (KFF, Jan 2026). In ACA Marketplace (HealthCare.gov) plans, insurers denied 19% of in-network claims in 2024, and fewer than 1% of those denials were appealed (KFF).

A 2022 federal audit of 250 sampled Medicare Advantage prior-auth denials found that 13% met Medicare coverage rules. One pattern it named: plans requiring an x-ray before approving more advanced imaging, which Medicare rules don't require (HHS OIG, OEI-09-18-00260).

Winning one of these appeals is mostly careful reading. You find the payer's policy as it stood on the date of service, check each requirement against the chart, and quote both exactly. A small practice's biller rarely has time for that on every denial.

The payers already do this work with software. Availity, Cohere Health and Anterior sell criterion-by-criterion evidence review to health plans, and eviCore runs imaging review for them. The provider-side tools we found mostly generate appeal letters and are sold to hospitals and health systems. We wanted the payer's own view of a case, built for the practice.

## What it does

Denial Auditor works one kind of denial: outpatient lumbar MRI (CPT 72148). It takes the faxed denial letter and the chart notes and returns a recommendation with evidence.

1. **Reads the fax and triages it.** Nemotron 3.5 Super-VL reads the scanned letter. A fixed reason-code (CARC) table sends it one of three ways: an administrative denial gets a fix checklist, a plan exclusion is marked not winnable, and a clinical denial goes on to review.
2. **Fetches the policy in force on the date of service.** For Medicare and Medicare Advantage, the CMS Coverage API keeps every version of LCD L34220, so the version is picked by date. A June 2, 2025 service date gets v37, and a July 25, 2026 one gets v40 (effective 10/23/2025). For Aetna, a Tavily search finds Clinical Policy Bulletin 0236 on aetna.com at runtime, and the page is fetched directly.
3. **Splits the policy into rules, in the payer's own words.** Code numbers every sentence of the fetched text, and Nemotron 3 Super only picks sentence ids. Each rule's wording is therefore cut from the source, not written by a model.
4. **Checks each rule against the chart.** Nemotron 3 Nano pulls chart facts, each with a quote, and code finds every quote in its note. Code, not a model, computes durations from the chart's dates. Two Nemotron 3 Super calls judge each rule independently. If they disagree, Nemotron 3 Ultra decides, and the rule is marked as escalated. A "met" with no verified evidence is downgraded to "missing documentation".
5. **Decides with a fixed rule, not a model.** The five outcomes are: appeal, ask the physician, don't appeal yet, fix and resubmit, or not winnable.
6. **Drafts the appeal behind a citation gate.** Ultra drafts the letter from pre-verified quotes only. Super critiques it as the payer's medical reviewer would, and Ultra revises it. Export stays locked unless every quoted passage matches the policy fetched for that case, or the chart, word for word. Change "four weeks" to "two weeks" in a quote and that quote is marked void, the sentence the source really contains appears beside it, and export locks.
7. **Asks the physician when the chart falls short.** It doesn't write a weaker appeal. It drafts a documentation request that quotes the rule and says: "Please don't add anything that didn't happen; only document care that was actually provided."

Two more modes use the same checks:
- **Prior-auth check (before you submit).** It runs the checks on a request before it goes out. When a waiting period is the only gap, code works out the earliest date the chart can meet it.
- **Policy watch.** A nightly job with no model compares the policy version each open case cites with the live source. It names the rules whose exact wording no longer appears.

What it won't do:
- It never submits anything. A person reviews, exports and sends every letter.
- Appeal deadlines come from a fixed table checked against eCFR, never from a model: 42 CFR 422.582(b), 42 CFR 405.942(a), 45 CFR 147.136(b) and 29 CFR 2560.503-1(h)(3)(i).
- It says what the policy for the date of service requires. It never says a denial was unlawful.

**Scope today:** lumbar MRI (CPT 72148); Medicare and Medicare Advantage through LCD L34220 for practices in Noridian's 13 states (AK, AZ, CA, HI, ID, MT, ND, NV, OR, SD, UT, WA, WY); and Aetna CPB 0236. Any other payer or state gets a clear refusal, not a guess. That scope is narrow on purpose: it is one policy family we could check end to end against gold answers.

## How we built it

**Models (all NVIDIA Nemotron, all called through Nebius Token Factory at runtime).** We probed each model before choosing it (`scripts/probe_models.py`, Oct 21).

| Step | Model | Why this model |
|---|---|---|
| Read the scanned denial letter | Nemotron 3.5 Super-VL | The only vision model on our key. Token Factory lists its image price as $0. |
| Read a text notice / triage without a reason code | Nemotron 3 Nano, thinking off | In our probe, a small extraction took 0.4 s with thinking off and 4.2 s with it on. |
| Split the policy into rules (pick sentence ids) | Nemotron 3 Super | 7 of 7 gold criteria in 3 of 3 runs. Ultra matched it at about 3× the cost; Nano got 6 of 7, and Lightning was slowest and missed one. |
| Extract chart facts with quotes | Nemotron 3 Nano | A cheap first pass. Every quote is re-found by code, so an invented one is dropped. |
| Judge each rule against the chart | Nemotron 3 Super ×2, Ultra on a split | One Nano vote got 16 of 29 recommendations right on our set; two Super votes plus the Ultra referee got 30 of 30. Ultra decided 58 of the 410 rule checks in that run. |
| Draft, critique, revise the appeal | Ultra, then Super, then Ultra | Ultra writes; Super plays the payer's reviewer. |

Nemotron 3.5 Lightning took 50 to 230 seconds even on small prompts in our tests, so it isn't on any request path.

Every model call uses `response_format` with a JSON schema and is validated with pydantic. Models only ever return text, and code checks every piece of it. Rule wording is cut from the source by sentence id. Chart quotes are located with a substring match, and offsets from the model are never trusted. Durations come from dates, the verdict from a fixed rule, and deadlines from a table.

**Policy sources.** The CMS Coverage API is the primary source: free, versioned, and returning each LCD version's effective dates. Aetna doesn't publish prior versions of a bulletin, so Aetna CPB 0236 is a dated snapshot. The tool records the fetch date and Aetna's "Last Review" date (04/09/2026 in our showcase run), and labels the result as a snapshot, not a versioned policy. The policy watch re-fetches it and flags changes.

**Spend caps in code.** A custom httpx transport sits under the OpenAI SDK. It checks the worst-case cost of every Token Factory request against a project cap before sending it, and records the actual cost afterwards. Tavily calls go through the same kind of guard. The caps are $27 for Token Factory and 4,125 credits for Tavily. The development ledger shows about $6.23 spent so far (Oct 28), including every 30-case evaluation.

**App.** The backend is FastAPI. The frontend is React with shadcn components. The case screens speak a biller's language (rules, quotes, deadlines, money at stake); the model-level detail (which Nemotron model ran each step, votes, referee calls, cost per case) lives on the How it works page. Every quote in the UI links to the exact sentence it came from in the policy or the chart. A live run streams what the pipeline is doing as it happens: each step's result, then each rule as it is checked, with a running tally. The app runs on Google Cloud Run, scaled to zero, with keys in Secret Manager and the spend ledgers in a Cloud Storage bucket. The policy watch runs as a nightly Cloud Run job with a $0 model cap.

**Evaluation.** We wrote 30 synthetic cases in 7 groups, each with ground truth (`cases/*/scenario.json`) and gold policy anchors (`eval/gold/`). Every letter is read from its scanned image.

| | Super ×2 + Ultra referee | Nano, one vote |
|---|---|---|
| Triage route | 30/30 | 29/29 ¹ |
| Recommendation | 30/30 | 16/29 (55%) |
| Gold rule statuses | 138/138 | 119/131 (91%) |
| Mean cost per case | $0.048 | $0.010 |
| Mean time per case | 72 s | 90 s |

¹ One Nano run returned malformed output (a runaway answer cut off mid-JSON) and isn't scored. In the Nano run only fact extraction and matching ran on Nano; model and vote count changed together, so this doesn't isolate either.

These are synthetic cases we wrote, scored against our own ground truth. They show the pipeline does what we designed on the situations we designed. They don't show accuracy on real charts.

## Challenges we ran into

- **Models paraphrase policy text.** When we asked for spans, we got near-quotes. Switching to sentence ids made exact wording a property of the design.
- **"Doesn't apply" isn't "met".** Early matchers marked an exclusion that didn't describe the patient as "met". We moved to effect-based statuses with code rules on top, then added the second vote and the Ultra referee. On a five-case pilot the early matchers got 1 of 5 (Nano) and 2 of 5 (Super) recommendations right. Two votes with a referee got 24 of 24 clinical cases, then 30 of 30 on the full set.
- **Small models are confidently wrong in a specific way.** Nano's misses were mostly "blocks" on the red-flag route when the patient simply had no red flags (8 of 18), and "undocumented" for four weeks of care that was in the chart (3 of 18). One extra Super vote cost about 5× more and removed both.
- **Aetna has more than one route to coverage.** Some of our synthetic patients qualified through a route we hadn't planned for. The scenarios were wrong, not the model.
- **Unicode.** Models emit U+2011 non-breaking hyphens. The gate treats hyphen variants as equal, but keeps words, digits, case and dashes strict.
- **Licences.** eviCore, Carelon and ACR terms forbid reuse, so that text is never sent to a model or stored (`sources.assert_allowed`), and we link to it by name only. UHC was dropped because its imaging criteria are eviCore text.

## Accomplishments that we're proud of

- An appeal can't be exported unless every quote is found word for word in a source fetched for that case. In the showcase appeal (case 015), all 12 unique quoted passages pass, 22 uses in all.
- The policy version comes from the date of service, not from whatever is live today.
- It can say "don't appeal yet" or "ask the physician", and it explains why.
- Every model call, vote, referee decision and cost is recorded in each case's saved run, and the How it works page walks through one real run step by step.

## What we learned

Reasoning models judge one rule at a time well. They're poor sources of truth for quotes, dates and arithmetic. The product got better each time we moved one of those jobs from the model into code.

## What's next

- **Measure what matters with real users.** We haven't tested with a biller and haven't measured time saved per denial. The first step is a pilot with a small practice or billing company on de-identified denials, timing a manual appeal against an assisted one, and tracking overturn outcomes.
- **Before any real patient data:** business associate agreements with every vendor, confirmation of Token Factory's data terms, and a commercial AMA CPT licence.
- **Wider coverage:** other Medicare contractors' LCDs, CT and other imaging codes, more commercial payers, and PDF or fax intake.
- **CMS-0057-F:** from January 2027, covered payers must offer a prior-authorization API that lists required documentation. The prior-auth check should read it.

---

## Built with

nvidia-nemotron, nebius-token-factory, tavily, cms-coverage-api, python, fastapi, pydantic, httpx, openai-sdk, react, typescript, vite, shadcn-ui, google-cloud-run, google-cloud-storage, google-secret-manager, docker, remotion, amazon-polly

## Try it out (links)

- Live demo: https://denial-auditor-898760356208.us-central1.run.app
- Source code: https://github.com/codebreaker32/denial-auditor
- Demo video: https://youtu.be/aWevndkFuQM

---

## Testing instructions for judges

The demo is free to browse. It uses synthetic patients only and needs no account. The server scales to zero, so the first load after a quiet spell can take a few seconds.

**Sign in (10 seconds)**
1. Open https://denial-auditor-898760356208.us-central1.run.app.
2. Click **Open the demo**, then **Continue to the demo**. There's no password.

**1. An appeal, and the citation gate (about 60 seconds)**
1. In the **Worklist**, open **Drew Exemplar** (case 015, a Medicare Advantage plan that denied a lumbar MRI for having no x-ray first).
2. Open the **Policy** tab: LCD L34220 v40, the version in force on the date of service, from the CMS Coverage API. Open the **Rules** tab: each rule is in the policy's own words, with the verified chart quote beside it. No rule asks for an x-ray first.
3. Click **Review appeal**. The gate shows all 12 quoted passages matching their source.
4. Click **Edit**, change "four weeks" to "two weeks" inside a quoted passage, then switch back to **Letter**. The quote is struck through ("This quote isn't in the policy"), the policy's real sentence appears beside it, and the button reads **Export locked**. The count becomes "1 of 13" because your edit is a new, unmatched passage. To undo, click **Edit**, then **Restore the draft**, and Export unlocks.

**2. Ask the physician (about 20 seconds)**
1. Back in the Worklist, open **Indigo Testdata** (case 031). The recommendation is **Ask the physician**.
2. Open the request. It quotes the four-week conservative-care rule from L34220 and asks the physician to document only care that actually happened.

**3. Prior-auth check and timeline (about 30 seconds)**
1. Open **Prior-auth checks** in the left rail, then **Emerson Specimen** (case 009, Aetna, planned for 08/03/2026).
2. Aetna CPB 0236 asks for six weeks of conservative therapy. The chart documents 38 of 42 days. On the timeline, code places the earliest qualifying date at 07/31/2026, which is before the planned date, so the result reads "Qualifies if charted": the wait is reached, but the chart has to record it.

**4. Optional: a live run (2 to 3 minutes, real Token Factory and Tavily calls, about $0.06)**
1. Open **Run live**, pick an **Aetna** case (for example Emerson Specimen) to see the runtime Tavily call, and enter the passcode: **[DEMO PASSCODE — paste into the Devpost field only, never into this file]**. 2. Watch each step report its result as it runs: the denial read from the scan, the policy found for the date of service (on Emerson: "Finding the policy in effect on the date of service (Tavily search)", then "Aetna CPB 0236 · snapshot fetched … · found with a web search"; on a Medicare case it says "(CMS Coverage API)"), the rules found in the policy, then each rule appearing as it is checked, with its status and a running tally, and finally the recommendation. On Drew Exemplar the appeal is drafted and every quote checked.
3. **Cost and limit:** each live run makes real calls to NVIDIA Nemotron on Nebius Token Factory (about **$0.06** per run, plus one Tavily search on an Aetna case). To keep the demo's spend bounded, the passcode allows **10 live runs in total**, shared by all judges, and the Run live page shows how many are left. Please run one or two at most. Once they're used up, the saved cases above show the same pipeline's output, and the video shows a full live run.

**Run it locally:** see the README. It needs Python 3.12, Node 20+, and a Token Factory and Tavily key in `.env`.

---

## How we used Nebius Token Factory and NVIDIA Nemotron

We used no other Nebius service: Token Factory serves every model call, and the app itself is hosted on Google Cloud Run. Every model call in the app goes to the Token Factory OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1/`) at runtime, and every model is an NVIDIA Nemotron open model. We probed five and use four of them:
- Nemotron 3 Nano 30B-A3B
- Nemotron 3 Super 120B-A12B
- Nemotron 3 Ultra 550B-A55B
- Nemotron 3.5 Super-VL
- Nemotron 3.5 Lightning (probed, then left out)

We followed the track's advice literally: Ultra for the hard reasoning, Nano and Super for the fast everyday calls.
- **Super-VL** reads the scanned fax.
- **Nano** handles quick extraction, with thinking off where that's safe.
- **Super** picks policy sentences and casts two independent votes per rule.
- **Ultra** steps in only when the two Super votes disagree (58 of 410 rule checks in our final run), and writes and revises the appeal.

That routing is why a full case costs a mean of $0.048 and 72 seconds on our test set.

We chose models by measurement, not by reputation:
- All five honoured `response_format` json_schema in our probe.
- Nano with thinking off took 0.4 s instead of 4.2 s.
- Lightning took 50 to 230 seconds, so we dropped it from every request path.
- Super and Ultra both recalled 7 of 7 gold policy criteria in 3 of 3 runs, so we use the cheaper Super.

Token Factory made it practical to call several model sizes from one API key and one client, and to swap a step's model by changing one constant.

**Feedback on Token Factory and Nemotron (for the Most Valuable Feedback prize)**
1. Structured output worked on every Nemotron model we tried. Please list it per model in `GET /v1/models` (`supported_features` showed only "tools" and "reasoning").
2. Reasoning can use up `max_tokens` and return empty `content`. We retry once with double the tokens. A documented reasoning budget, or a guaranteed answer after reasoning, would remove this class of failure.
3. `chat_template_kwargs: {enable_thinking: false}` made simple extraction on Nano about 10× faster. It's easy to miss; a first-class parameter would help.
4. `content` starts with a newline on reasoning models, so JSON parsers need a strip.
5. Model IDs mix formats (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/Nemotron-3_5-Lightning`) and are case-sensitive. Aliases would prevent 404s.
6. Lightning took 50 to 230 s even for small prompts in our tests. A latency note per model would help planning.
7. There's no per-key spending cap, so we built one client-side. A server-side hard cap per key would make hackathon and production budgets safer.
8. Images showed a price of $0 on Super-VL. That's great for document intake; please confirm it's intended.

## How we used Tavily

When a clinical denial comes from Aetna, the pipeline has to find the bulletin that covers the service as Aetna publishes it now. At runtime, `aetna.find_cpb` calls Tavily search, restricted to aetna.com, with a fixed query ("Aetna Clinical Policy Bulletin MRI and CT of the spine"). It takes the first result that matches Aetna's bulletin URL pattern, then fetches that page and cuts it to its Policy section. Tavily extract was tried first, but on these pages it dropped the nested criteria list.

The query never contains patient data, only the payer and the service. Each server instance keeps the result per query, so a fresh instance makes the call again. You can see it in a live run on an Aetna case: the policy step reads "Finding the policy in effect on the date of service (Tavily search)". Every Tavily call passes through a credit cap in code.

---

## Sponsor survey answers (paste as is)

**Which model(s) did you use, and why did you choose that size/variant?**
Four NVIDIA Nemotron models on Nebius Token Factory (five probed), each routed by measurement to the cheapest one that passed our checks: Nemotron 3.5 Super-VL reads the scanned denial letter; Nemotron 3 Nano 30B-A3B extracts chart facts and, with thinking off, handles quick extraction (0.4 s vs 4.2 s); Nemotron 3 Super 120B-A12B splits the policy into rules (7/7 gold rules in 3/3 runs) and casts two independent votes per rule; Nemotron 3 Ultra 550B-A55B referees only when the votes disagree (58 of 410 rule checks) and drafts the appeal. We tested Nemotron 3.5 Lightning and left it out because it took 50 to 230 s per call.

**How would you rate Nemotron's output quality for your use case? (1–10)**
8. Instruction-following and structured output were excellent: json_schema worked on every model, and two Super votes with an Ultra referee got 30/30 recommendations and 138/138 rule statuses on our 30 synthetic cases. Shortfalls: long reasoning sometimes used up max_tokens and returned empty content, a single Nano vote got only 16/29 recommendations, and Lightning was too slow for interactive use.

**Did you fine-tune, prompt-engineer, or use Nemotron out of the box?**
Out of the box with prompt engineering; no fine-tuning. Every step returns a validated schema, the model selects policy sentence ids instead of writing policy text, code verifies every quote and computes dates, deadlines and the final recommendation, and two independent votes plus a referee replaced prompt tweaking as our main accuracy lever.

**How did Nemotron's performance compare to other models you've used for similar tasks?**
We built only on Nemotron for this project. Across sizes, two Super votes with an Ultra referee cost about 5× a single Nano vote ($0.048 vs $0.010 per case) and raised correct recommendations from 16/29 to 30/30.

**Which Nebius platform capabilities were most valuable, and how did you run Nemotron?**
Token Factory's serverless, OpenAI-compatible API. One key and the standard OpenAI SDK reached five model sizes with no GPUs to provision, so switching a step's model was a one-line change. Structured output on every model, and per-call usage that let us show cost per case and enforce a hard $27 project cap in code. Rule checks run four in parallel; the app is hosted on Google Cloud Run and calls Token Factory at runtime.

**How likely are you to recommend running Nemotron on Nebius to other developers? (1–10)**
8. Fast to start, no infrastructure, many sizes under one key, reliable structured output and low cost. It would be a 10 with a server-side spending cap per key, consistent model IDs, and no empty responses after long reasoning.

**How would you rate your experience running Nemotron inference on Nebius compared to previous environments? (1–10)**
8. Nothing to provision, and moving between a 30B and a 550B model cost nothing to set up. Nano with thinking off was quick enough for interactive steps; larger reasoning models are slower, so we ran checks in parallel.

**What additional features or improvements would have made it more effective?**
A server-side hard spending cap per API key; structured-output support listed per model in GET /v1/models; a reasoning budget or guaranteed answer so content is never empty; enable_thinking as a first-class parameter; consistent, case-insensitive model IDs; and a published latency guide per model.

**What do you most hope to see from the Nemotron team next?**
A fast vision-language model tuned for scanned administrative documents (faxes, forms), controllable reasoning length, and a Lightning variant with interactive latency.

**Did you use Tavily in your project?**
Yes. At runtime, for Aetna denials, the app calls Tavily search restricted to aetna.com with a fixed query (no patient data) to locate the current Clinical Policy Bulletin for the service, then fetches it and extracts the policy section. Every call goes through a credit cap in code.

## Disclosures

- **Synthetic data only.** Every patient, chart note, denial letter and billed amount is synthetic and labelled as such. No real patient information is used anywhere in the repo, the demo or the video. Where a real payer (Aetna) is named, the member and the notice are fictional. Nemotron 3 Super generated the synthetic chart notes from our scenario specs.
- **Decision support, not advice.** It isn't legal or medical advice. A person reviews and sends every appeal, and the tool never submits anything.
- **AI-assisted development.** We built the software with an AI coding assistant (Claude Code) and reviewed its output. The code is Apache-2.0.
- **CMS Coverage API.** Medicare LCD text comes from the CMS Coverage API. Retrieving full LCD text requires accepting the AMA CPT licence for personal, non-commercial use, which we accepted for this hackathon.
- **CPT.** CPT® is a registered trademark of the American Medical Association. CPT descriptors are © American Medical Association, all rights reserved. We show bare codes only, never AMA descriptors.
- **Aetna.** Aetna Clinical Policy Bulletin 0236 is fetched live from aetna.com and quoted briefly with attribution, a link and the review date. It isn't redistributed, and the cached snapshot is never committed.
- **eviCore, Carelon, ACR.** Their terms forbid reuse, so their text is never sent to a model or stored. We link to them by name only.
- **Fonts.** Geist and IBM Plex Mono, both under the SIL Open Font License 1.1.
- **Video.** Voiceover by Amazon Polly (generative voices Matthew and Ruth). The music bed and sound effects were synthesised from scratch in code, with no samples or third-party recordings. There's no third-party music.
- **Statistics.** KFF (2024 data, published 2025 and Jan 2026), HHS OIG OEI-09-18-00260 (2022), and eCFR, all quoted as written in their sources.

---

## Pre-submission checklist

- [ ] **Make the repo public:** github.com/codebreaker32/denial-auditor is PRIVATE today. The user decides when; the rules need it public at submission.
- [ ] **Licence detected:** GitHub shows "Apache License 2.0" (it already detects it via `gh repo view`). Confirm it shows in the About sidebar once public.
- [ ] **Demo URL works** from a logged-out browser: the landing page, sign-in, case 015, 031 and 009, and the Run live page showing "10 of 10 live runs left". Don't start a live run yourself: there are 10 in total for the judges. The service must stay up until judging ends Dec 15; the auto-shutdown runs Dec 16.
- [ ] **Passcode for judges only:** attach `submission/Denial_Auditor_Testing_Instructions.pdf` (built by `scripts/build_judges_pdf.py`; it has the passcode and is gitignored) in a judges-only field, or paste the passcode into the judges-only testing-instructions field. Never in the public repo, the story text or the video.
- [ ] **Video:** upload the latest `video/out/final.mp4` (under 3:00) to YouTube as Public (not Unlisted), and paste the link in place of [YouTube link]. No third-party music or logos.
- [x] **Video copy matches the app:** the check scene now shows "Qualifies if charted" with 38 of 42 days and earliest Jul 31; the appeal line says "Twelve of twelve"; the closing line makes no time-saving claim.
- [ ] **Team members added** on Devpost: Aman Bihari, Bhawna.
- [ ] **Track selected:** Best Apps & Agents.
- [ ] **Built-with tags** and **Try it out** links filled in.
- [ ] **Gallery images** uploaded: `docs/gallery/01-cover.png` first, then 02 to 07 (2400×1600, synthetic data only).
- [x] **Geist licence file:** `ui/public/fonts/geist-OFL.txt` and `video/public/fonts/geist-OFL.txt` are in the repo.
- [ ] **Fact check:** read this page once against the Fact register below after any edit.
- [ ] Submit before **Fri Oct 30, 2026, 10:00 am PT**. Nothing can change after the deadline.

---

## Fact register

Every number and checkable claim above, with where it comes from. Repo paths are relative to the repo root.

| Claim as used | Source | Verbatim quote or value |
|---|---|---|
| MA 2024: 11.5% of denied prior-auth requests appealed | KFF, Jan 28 2026, via `docs/facts.md` ([link](https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/)) | "A small share of denied prior authorization requests was appealed in Medicare Advantage –11.5% in 2024" |
| MA 2024: 80.7% of appeals partly or fully overturned | same | "most appeals (80.7%) were partially or fully overturned in 2024" |
| ACA Marketplace: 19% of in-network claims denied in 2024 | KFF, ACA Marketplace 2024, via `docs/facts.md` ([link](https://www.kff.org/private-insurance/issue-brief/claims-denials-and-appeals-in-aca-marketplace-plans-in-2024/)) | "denied 19% of in-network claims in 2024" |
| Fewer than 1% of those denials appealed | same | "an appeal rate of less than 1%" |
| OIG: 13% of sampled MA prior-auth denials met Medicare rules; 250 sampled denials | HHS OIG OEI-09-18-00260, via `docs/facts.md` ([link](https://oig.hhs.gov/reports-and-publications/all-reports-and-publications/some-medicare-advantage-organization-denials-of-prior-authorization-requests-raise-concerns-about-beneficiary-access-to-medically-necessary-care)) | "among the prior authorization requests that MAOs denied, 13 percent met Medicare coverage rules"; notes: "a sample of 250 denials by 15 large MA plans" |
| OIG pattern: x-ray before advanced imaging | same | "requiring an x-ray before approving more advanced imaging" |
| Payer-side tools do criterion-level review (Availity, Cohere, Anterior, eviCore); provider-side tools are mostly letter generators sold to hospitals | `docs/research/competitors.md` lines 9–10, 48–51 (vendor pages linked there) | "Criterion-level matching of chart evidence against policy text already exists, but on the payer side." / "Provider-side tools are mostly appeal-letter generators sold to hospitals and health systems." |
| CPT 72148 is the tested code | `cases/case_015/scenario.json`, `demo/runs/case_015.json` | `"cpt": "72148"` |
| L34220 practices in 13 Noridian states (list) | `src/nebius_nvidia/pipeline.py` | `NORIDIAN_STATES = {"AK", "AZ", "CA", "HI", "ID", "MT", "ND", "NV", "OR", "SD", "UT", "WA", "WY"}` |
| Other payers/states refused | `src/nebius_nvidia/pipeline.py` | `class UnsupportedPolicy(LookupError)` raised by `resolve_policy` |
| June 2, 2025 DOS → v37; July 25, 2026 DOS → v40 (eff 10/23/2025) | `eval/results/final_super_scan.json` | case_007: dos 2025-06-02, version 37, 2022-08-18 to 2025-10-22; case_015: dos 2026-07-25, version 40, from 2025-10-23 |
| Version chosen by DOS from CMS Coverage API | `src/nebius_nvidia/cms.py` | `def lcd_on(self, lcd_id: int, dos: date, ...)`; `CMS_API = "https://api.coverage.cms.gov/v1"` |
| Aetna is a snapshot; Last Review 04/09/2026 | `src/nebius_nvidia/aetna.py` docstring; `demo/checks/case_009.json` | "Aetna publishes no prior versions, so the document is a dated snapshot"; `version_basis: "snapshot-at-fetch"`, `effective_from: "2026-04-09"` |
| Tavily runtime search, aetna.com only, fixed query | `src/nebius_nvidia/aetna.py` | `client().search(query=query, include_domains=["aetna.com"], max_results=5)`; `find_cpb("Aetna Clinical Policy Bulletin MRI and CT of the spine")` |
| Tavily extract dropped nested criteria | `src/nebius_nvidia/aetna.py` docstring | "Tavily extract was tried first: on these pages it drops the nested criteria list" |
| Tavily result cached per instance; cache not in image | `aetna.py`; `.dockerignore` | "Results are cached on disk per query."; `.dockerignore` lists `.cache` |
| Live step label "(Tavily search)" / "(CMS Coverage API)" | `src/nebius_nvidia/pipeline.py` | `say("Finding the policy in effect on the date of service" + (" (CMS Coverage API)" if ... else " (Tavily search)"))` |
| Token Factory base URL; five Nemotron model IDs | `src/nebius_nvidia/llm.py` | `BASE_URL = "https://api.tokenfactory.nebius.com/v1/"`; `NANO`, `SUPER`, `ULTRA`, `LIGHTNING`, `SUPER_VL` constants |
| Super-VL reads scanned letter; Nano thinking off for text | `src/nebius_nvidia/intake.py` | `model = SUPER_VL` for .png; `model = NANO` … `thinking = False` for text |
| Triage: CARC table, Nano (thinking off) only without a code | `src/nebius_nvidia/triage.py`; `demo/runs/case_015.json` | `NANO … thinking=False`; case 015 triage `method: "carc_table"` |
| Chart facts by Nano, quotes located by code | `src/nebius_nvidia/facts.py` | `structured(NANO, …)`; `hit = locate(q.quote, n.text)` → `verified=True` |
| 2 Super votes, Ultra referee on split | `src/nebius_nvidia/match.py` | "With votes=2, two independent judgments by `model`; if they disagree, `referee` (Ultra) decides and the match is marked escalated." |
| Ultra decided 58 of 410 rule checks | `eval/results/final_super_scan.json` (counted `confidence == "escalated"`) | 58 escalated of 410 matches |
| Appeal: Ultra draft, Super critique, Ultra revise | `src/nebius_nvidia/appeal.py`; `pipeline.py` | `drafter: str = ULTRA, critic: str = SUPER, revise: bool = True`; "Drafting the appeal (Ultra), payer-reviewer critique (Super), revision (Ultra), citation gate" |
| Gate: exact match, only meaning-free normalisation, no ellipses | `src/nebius_nvidia/citations.py` | "words, digits, case and dashes must match exactly. Elided quotes (\"...\" / \"…\") are not allowed." |
| Hyphen variants (U+2011) treated as equal | `src/nebius_nvidia/text.py` | "Hyphen variants render the same as \"-\" and mean the same (models often emit U+2011)." |
| Case 015: 12 unique quoted passages, 22 uses, all verified | `demo/runs/case_015.json` (`gate.checks`) | 22 checks, 12 unique texts, all `status: "verified"`, `gate.ok: true` |
| "four weeks" is in a quoted passage of the case 015 letter | `demo/runs/case_015.json` (`appeal.rendered`) | "…conservative management lasting at least four weeks." followed by "> — L34220 v40, eff 10/23/2025, CMS Coverage API" |
| Case 031: Ask the physician; request wording | `demo/runs/case_031.json` | `verdict: "doc_request"`; "Please don't add anything that didn't happen; only document care that was actually provided." |
| Case 009: 38 of 42 days; earliest 07/31/2026; planned 08/03/2026 | `demo/checks/case_009.json` | "6 weeks of conservative therapy: 38 of 42 days documented; if care continues from 07/27/2026, reached 07/31/2026"; `planned_dos: "2026-08-03"` |
| Case 009 shows "Qualifies if charted" | `ui/src/features/check/model.ts` | `r === "not_yet" && !!earliest && earliest <= planned ? "charted" : r`; `charted: { label: "Qualifies if charted", …}` |
| Deadlines from a fixed table with eCFR citations | `src/nebius_nvidia/rules.py` | citations "42 CFR 422.582(b)", "42 CFR 405.942(a)", "45 CFR 147.136(b); 29 CFR 2560.503-1(h)(3)(i)" |
| Prevention earliest date in code | `src/nebius_nvidia/prevention.py` | `def earliest_date(policy_id, facts, planned_dos)`; `THRESHOLDS = {…}` |
| Policy watch: no model, $0 cap, nightly | `src/nebius_nvidia/drift.py`; `Dockerfile`; `CLAUDE.md` | "The policy watch runs beside the app: once at start, then nightly at 03:00 UTC, with a $0 model cap." |
| Super eval: 30/30 triage, 30/30 recommendation, 138/138, $0.0479, 72 s | `eval/results/final_super_scan.md` | "Triage route accuracy \| 30/30 (100%)", "Verdict accuracy \| 30/30 (100%)", "Gold-criterion status accuracy \| 138/138 (100%)", "Mean cost per case \| $0.0479", "Mean latency per case \| 72 s" |
| Nano eval: 29/29, 16/29, 119/131, $0.0098, 90 s, 1 error | `eval/results/final_nano_scan.md` | "29 cases scored, 0 skipped, 1 errors"; "16/29 (55%)"; "119/131 (91%)"; "$0.0098"; "90 s" |
| Nano misses 8 of 18 red-flag, 3 of 18 four-week | `eval/results/final_nano_scan.md` | "G1_red_flag_indication: 10/18" (8 misses); "G4_four_weeks_conservative: 15/18 (misses: met→missing_documentation ×3)" |
| ~5× cost Super vs Nano | `final_super_scan.md` / `final_nano_scan.md` | $0.0479 / $0.0098 = 4.9 |
| 30 cases in 7 groups | `README.md`; `eval/results/final_super_scan.json` | "30 synthetic cases in 7 groups" |
| Pilot 1/5 (Nano), 2/5 (Super); 24/24 clinical with two votes; 30/30 full set | `eval/results/pilot_nano.md`, `pilot_super.md`, `super_votes2.md`, `final_super_scan.md` | "Verdict accuracy \| 1/5 (20%)"; "Verdict accuracy \| 2/5 (40%)"; "24 cases scored … Verdict accuracy \| 24/24 (100%)"; "30/30 (100%)" |
| Probe: all five honoured json_schema; Nano 0.4 s vs 4.2 s; Lightning 49.8–190 s | `.cache/model_probe.json` (from `scripts/probe_models.py`) | Nano `prompt_only` 4.2 s, `prompt_only_no_thinking` 0.4 s; every model `json_schema.ok: true`; Lightning 190.0 / 118.4 / 49.8 s |
| Lightning 50–230 s; not on any request path | `CLAUDE.md`; `src/nebius_nvidia/criteria.py` | "Lightning takes 50–230 s even for small prompts and is not used on any request path"; "Lightning was slowest (~230 s) and missed one" |
| Super 7/7 gold in 3/3; Ultra also; Super ~3× cheaper; Nano 6/7 | `src/nebius_nvidia/criteria.py` docstring | "Super and Ultra both recalled 7/7 gold criteria in 3/3 runs; Super is ~3x cheaper … Nano 6/7." |
| Super-VL image price $0 | `.cache/model_probe.json` (`advertised`) | `"image": "0"` for `nvidia/Nemotron-3.5-Super-VL` |
| `supported_features` lists only tools and reasoning | `.cache/model_probe.json` | `"supported_features": ["tools", "reasoning"]` |
| Empty content → retry with 2× max_tokens | `src/nebius_nvidia/llm.py` | "Empty content (reasoning used the token budget) → one retry with 2× max_tokens." |
| Caps $27 / 4,125 credits | `src/nebius_nvidia/budget.py` | `DEFAULT_CAP_USD = 27.0`; `DEFAULT_TAVILY_CAP = 4125` |
| ~$6.23 spent (dev ledger) | `.token_factory_spend.json` (read 2026-10-28, afternoon) | `spent_usd` ≈ 6.23; its note says part was reconstructed after a ledger race. The Cloud Run ledger in `gs://nebius-nvidia-state` is separate and wasn't read. |
| Live runs: passcode, 10 in total; refused once used up (limit tested on the deployment, $0) | `src/nebius_nvidia/api.py`; `ui/src/features/live/Live.tsx` | `TOTAL_LIMIT` default 10; "N of 10 live runs left on this demo. Each run makes real model calls, about $0.06." |
| Sign-in: "Open the demo" → "Continue to the demo", no password | `ui/src/landing/Landing.tsx`; `ui/src/app/Login.tsx` | "Open the demo"; "Continue to the demo"; "There is no password and nothing to sign up for." |
| UI labels: Worklist, Prior-auth checks, Run live, Rules, Policy, Review appeal, Edit, Letter, Export locked, Restore the draft, Ask the physician | `ui/src/app/Shell.tsx`, `features/case/Detail.tsx`, `features/case/model.ts`, `features/appeal/Appeal.tsx`, `lib/data.ts` | as quoted in the source |
| Patients: Drew Exemplar (015), Indigo Testdata (031), Emerson Specimen (009) | `cases/case_0NN/scenario.json` | `patient_name` fields |
| Live run streams step results and each rule as it is checked | `src/nebius_nvidia/pipeline.py` (`emit`), `match.py` (`on_done`), `ui/src/features/live/Live.tsx`; `tests/test_live_events.py` | events `{at, step, kind: start/detail/rule/done, text}`; "11 of 15 rules checked · 4 supported · 1 blocking · 6 don't apply" |
| Live run on Aetna shows the Tavily step | `src/nebius_nvidia/pipeline.py` | `" (Tavily search)"`; `"Aetna … · snapshot fetched … · found with a web search"` |
| Hosting: Cloud Run, scale to zero, Secret Manager, GCS ledger, nightly job | `CLAUDE.md` (Hosting) | "Google Cloud Run … Scale to zero (min 0, max 1 …)"; "spend ledger and `drift_report.json` in bucket `gs://nebius-nvidia-state`" |
| Demo URL live | `curl` on 2026-10-28 | `GET /api/cases` returned case rows |
| Repo private; Apache-2.0 detected | `gh repo view` on 2026-10-28 | `"licenseInfo":{"key":"apache-2.0"…},"visibility":"PRIVATE"` |
| Fonts Geist and IBM Plex Mono, OFL 1.1 | `ui/public/fonts/geist-OFL.txt`, `plex-mono-OFL.txt`; `video/CREDITS.md` | "This Font Software is licensed under the SIL Open Font License, Version 1.1." |
| Polly voices; synthesised SFX | `video/CREDITS.md` | "Amazon Polly (generative voices Matthew and Ruth)"; "synthesised from scratch with numpy … no samples, no third-party recordings" |
| eviCore/Carelon/ACR never sent to models; UHC dropped | `CLAUDE.md` | "Never send eviCore, Carelon or ACR text to a model or store it … link to them by name only (`sources.assert_allowed`)"; "UHC was dropped, because its imaging criteria are eviCore text" |
| CMS-0057-F prior-auth API from Jan 2027 | `docs/go-to-market.md` | "from Jan 2027, CMS-0057-F requires covered payers (MA, Medicaid/CHIP, federal-exchange plans) to offer a Prior Authorization API" (not re-verified against the Federal Register here) |
| 422.101: MA plans follow LCDs (context only; not used as a legal claim) | `docs/facts.md` | "(3) Written coverage decisions of local Medicare contractors…" |
