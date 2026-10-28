# Demo video script (target about 2:45, hard limit under 3:00)

Source of truth: `video/script.json` (`text` is the caption, `vo` keeps the expression and pause directions, `ssml` is the exact Amazon Polly request). Audio: `video/scripts/voiceover_polly.py` writes `video/public/voiceover/<id>.mp3` and `video/timing.json`. Times below are **measured** from the generated MP3s, with 0.3 s added before and 0.6 s after each scene.

Voices: Amazon Polly **generative** engine. Narrator **Matthew** (warm, conversational US male), and **Ruth** (expressive US female) for the one biller line in the hook. Pauses use SSML `<break>`; lines that land a point get a 0.2 s beat and `<prosody rate="92%">`.

Recording rules:
- Synthetic data only, with the on-screen banner visible.
- No third-party music or logos, apart from the sponsor names said aloud.
- Say each statistic exactly as written in `docs/facts.md`; our eval numbers are always "synthetic cases we wrote ourselves".
- Record at 1440×900 against the deployed URL, not localhost.

| Time | Scene | Screen | Voiceover |
|---|---|---|---|
| 0:00–0:08 | `greet` | Grey ground, the MRI glass bubble drifting in. Title card: team Road House. | Narrator (Matthew): "Hi, we're team Road House. Picture a billing specialist at a three-doctor practice, on a Monday morning." |
| 0:08–0:15 | `biller` | The synthetic fax-notice bubble lands on the desk; the word DENIED is circled. Small 'synthetic' watermark. | Biller (Ruth): "Oh, no. Another MRI denied. And the appeal clock is already running." |
| 0:15–0:30 | `stakes` | Two large numbers on white cards: 80.7% of appealed MA prior-auth denials overturned; 11.5% appealed. Source line: KFF, Jan 2026, Medicare Advantage, 2024. | Narrator (Matthew): "In Medicare Advantage, 80.7 percent of appealed prior-auth denials were overturned in 2024. But only 11.5 percent were appealed. Winning takes hours of reading that a small practice doesn't have." |
| 0:30–0:39 | `pitch` | Product name on the yellow highlight card; three short lines appear: reads the denial, checks the policy, proves every quote. | Narrator (Matthew): "So we built Denial Auditor. It checks each denial against the payer's own policy and tells you what to do next, with proof." |
| 0:39–0:49 | `worklist` | Screen recording: worklist, sorted by days left; recommendation pills and the Due column. | Narrator (Matthew): "It starts with the worklist: every denial, ranked by what to do and when it's due. Deadlines come from a fixed rules table, never from the model." |
| 0:49–1:00 | `case` | Open case_015 (Drew Exemplar, MA). Denial letter tab: 'plain radiographs of the lumbar spine are required before advanced imaging'. | Narrator (Matthew): "Let's open one. This Medicare Advantage plan denied a lumbar MRI for having no x-ray first. Nemotron reads the fax, and a reason-code table sends it to clinical review." |
| 1:00–1:15 | `rules` | Policy tab: L34220 v40, effective 10/23/2025, CMS Coverage API. Select a rule: its sentence lights up in the policy, the row opens with the verified chart quote. | Narrator (Matthew): "It pulls the Medicare policy in force on the date of service from the CMS Coverage API, and matches each rule, in the payer's own words, to the chart. Code finds every quote. Nothing here asks for an x-ray first." |
| 1:15–1:26 | `appeal` | Verdict: Appeal, decided by a fixed rule. Review appeal: letter with verified quotes in blue; gate reads 12 of 12 match their source. | Narrator (Matthew): "So a fixed rule says: appeal. Nemotron drafts the letter, and the citation gate checks every quote against its source. Twelve of twelve match." |
| 1:26–1:39 | `tamper` | Edit text: change 'four weeks' to 'two weeks'. Show letter: quote marked VOID, 'Source says' shows the real sentence, gate reads Export locked. | Narrator (Matthew): "Now, change one word. Four weeks becomes two weeks. The quote turns void, the real sentence appears beside it, and export locks. A person always sends the letter." |
| 1:39–1:48 | `physician` | case_031 (Indigo Testdata): verdict Ask the physician; the documentation request quoting the four-week conservative-care rule and 'Please don't add anything that didn't happen'. | Narrator (Matthew): "When the chart is missing something, it doesn't guess. It asks the physician, quoting the rule, to document only care that actually happened." |
| 1:48–2:01 | `check` | Before you submit: case_009 (Aetna). Readiness Not yet; 38 of 42 days of conservative therapy; earliest date on the timeline. | Narrator (Matthew): "Before a request goes out, the same checks run on the prior auth. Aetna needs six weeks of therapy and the chart shows thirty-eight days, so code works out the earliest date it qualifies." |
| 2:01–2:16 | `how` | One-line architecture: fax -> Nemotron on Nebius Token Factory -> CMS Coverage API / Tavily (Aetna) -> code: verdict, deadline, quote check -> human sends. | Narrator (Matthew): "Under the hood, NVIDIA Nemotron on Nebius Token Factory reads the letter and matches the rules, and Tavily finds Aetna's current policy at runtime. But code, not the model, decides verdicts, deadlines, and whether a quote is real." |
| 2:16–2:30 | `proof` | Eval card labelled 'Our synthetic test set (30 cases)': 30/30 recommendations, 138/138 rule statuses, $0.048 per case. | Narrator (Matthew): "On thirty synthetic cases we wrote ourselves, it got every recommendation and all 138 rule statuses right, at about five cents a case. That's the pipeline working as designed, not accuracy on real charts." |
| 2:30–2:43 | `close` | Demo URL on the yellow card, repo link, 'Denial Auditor, by Road House'. Synthetic data only. | Narrator (Matthew): "Those appeals are worth filing, and now a small practice has the time. Try the live demo below. Denial Auditor, by Road House. Thanks for watching." |

Total: 2:43 with padding (150.6 s of speech).

## Sources for every claim
- 80.7% / 11.5% / 2024 / Medicare Advantage prior auth: `docs/facts.md`, KFF, Jan 28, 2026.
- "Deadlines come from a fixed rules table": CLAUDE.md product invariant; `docs/devpost.md` (eCFR-checked table).
- Case 015 denial reason ("plain radiographs ... required before advanced imaging") and 12 of 12 unique quoted passages verified (22 uses): `demo/runs/case_015.json` (`gate.checks`).
- Ask the physician, "only document care that was actually provided": `demo/runs/case_031.json` (`doc_request`).
- Aetna six weeks, 38 of 42 days, earliest date computed in code: `demo/checks/case_009.json` (`earliest_basis`).
- 30/30 recommendations, 138/138 rule statuses, $0.0479 per case: `eval/results/final_super_scan.md`.
- Policy in force on the date of service from the CMS Coverage API; Tavily locates Aetna CPB 0236 at runtime; code decides verdict, deadline and quote checks: CLAUDE.md architecture, `docs/devpost.md`.
- "A person always sends the letter": CLAUDE.md product invariant.

## Shot list before recording
Run the live demo once (for the Tavily call on screen, optional); clear the gate edit between takes; keep the browser zoom at 100%. Clips needed: worklist, case (015), rules (015 policy tab), appeal (015), tamper (015 edit), physician (031), check (009). The hook, pitch, how, proof and close scenes are motion graphics.

## Don't say
- "never trained on";
- "HIPAA compliant";
- "real patients";
- any statistic that isn't in `docs/facts.md`;
- that it submits appeals;
- that most denials are wrong (the 80.7% counts appeals that were filed).
