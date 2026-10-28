# Demo video script (target 2:55, hard limit under 3:00)

Source of truth: `video/script.json` (`text` is the caption, `vo` keeps the expression and pause directions, `ssml` is the exact Amazon Polly request). Audio: `video/scripts/voiceover_polly.py` writes `video/public/voiceover/<id>.mp3` and `video/timing.json`. Times below are **measured** from the generated MP3s, with 0.3 s added before and 0.6 s after each scene.

Voices: Amazon Polly **generative** engine. Narrator **Matthew** (warm, conversational US male), and **Ruth** (expressive US female) for Maya, the fictional biller, in the opening. The opening (greet, biller, grind, stakes) is hand-written SSML (`ssml_raw` in script.json) with brighter pacing (`prosody rate` 104–110%) and short comic breaks. Pauses use SSML `<break>`; lines that land a point get a 0.2 s beat and `<prosody rate="92%">`.

Recording rules:
- Synthetic data only, with the on-screen banner visible.
- No third-party music or logos, apart from the sponsor names said aloud.
- Say each statistic exactly as written in `docs/facts.md`; our eval numbers are always "synthetic cases we wrote ourselves".
- Record at 1920×1080 against the deployed URL, not localhost (`video/scripts/record.py`).

| Time | Scene | Screen | Voiceover |
|---|---|---|---|
| 0:00–0:11 | `greet` | Night ground, the logo builds for 'team Road House'. Maya's avatar pops in with a name tag (fictional). Kinetic type on the beats: MONDAY · 8:01 AM · Coffee: hot · Inbox: 8 new denials, the denial pile dropping in. | Narrator (Matthew): "Hi, we're team Road House! Meet Maya, who runs billing at a small spine clinic. Monday, 8:01 a.m. Coffee: hot. Inbox: eight new denials." |
| 0:11–0:18 | `biller` | The synthetic fax slams in; a big red DENIED stamp lands on 'Oh, come on!' with a shake. Maya's speech bubble. The appeal clock starts ticking. | Maya (Ruth): "Oh, come on! Another MRI, denied? Okay. The clock's ticking. Let's do this." |
| 0:18–0:31 | `grind` | Kinetic checklist: find the policy, read every rule, match the chart, write the letter; an hours counter spins up; 'Payers check rule by rule. Why can't Maya?' | Narrator (Matthew): "To fight it, Maya has to dig up the payer's policy, read it rule by rule, match the chart, and write the letter. That's hours. Per denial. Payers check rule by rule. Why can't Maya?" |
| 0:31–0:44 | `stakes` | Punchline: 80.7% counts up and pops (appealed MA prior-auth denials overturned, 2024); 11.5% (ever appealed) with a bar that drains; source KFF, Jan 2026. Whoosh into 'What if checking took minutes?' | Narrator (Matthew): "Here's the wild part. In Medicare Advantage in 2024, 80.7 percent of appealed prior auth denials were overturned. Only 11.5 percent were appealed. What if checking took minutes?" |
| 0:44–0:53 | `pitch` | On the night band the mark pops and 'Denial Auditor' wipes in; the camera dives through it into the real landing page (homepage tour recording: hero with the policy globe, a smooth scroll through the sections). | Narrator (Matthew): "So we built Denial Auditor. It checks each denial against the payer's own policy and tells you what to do next, with proof." |
| 0:53–1:03 | `worklist` | Tour continues: the cursor clicks 'Open the demo', then 'Continue to the demo' on the login page, and lands on the worklist; ring on the days-left column, then the deadline figure 'From a rules table, not the model'. | Narrator (Matthew): "It starts with the worklist: every denial, ranked by what to do and when it's due. Deadlines come from a fixed rules table, never from the model." |
| 1:03–1:15 | `case` | Open case_015 (Drew Exemplar, MA). Denial letter tab: 'plain radiographs of the lumbar spine are required before advanced imaging'. | Narrator (Matthew): "Let's open one. This Medicare Advantage plan denied a lumbar MRI for having no x-ray first. Nemotron reads the fax, and a reason-code table sends it to clinical review." |
| 1:15–1:29 | `rules` | Policy tab: L34220 v40, effective 10/23/2025, CMS Coverage API. Select a rule: its sentence lights up in the policy, the row opens with the verified chart quote. | Narrator (Matthew): "It pulls the Medicare policy in force on the date of service from the CMS Coverage API, and matches each rule, in the payer's own words, to the chart. Code finds every quote. Nothing here asks for an x-ray first." |
| 1:29–1:40 | `appeal` | Verdict: Appeal, decided by a fixed rule. Review appeal: letter with verified quotes in blue; gate reads 12 of 12 match their source. | Narrator (Matthew): "So a fixed rule says: appeal. Nemotron drafts the letter, and the citation gate checks every quote against its source. Twelve of twelve match." |
| 1:40–1:53 | `tamper` | Edit text: change 'four weeks' to 'two weeks'. Show letter: quote marked VOID, 'Source says' shows the real sentence, gate reads Export locked. | Narrator (Matthew): "Now, change one word. Four weeks becomes two weeks. The quote turns void, the real sentence appears beside it, and export locks. A person always sends the letter." |
| 1:53–2:02 | `physician` | case_031 (Indigo Testdata): verdict Ask the physician; the documentation request quoting the four-week conservative-care rule and 'Please don't add anything that didn't happen'. | Narrator (Matthew): "When the chart is missing something, it doesn't guess. It asks the physician, quoting the rule, to document only care that actually happened." |
| 2:02–2:14 | `check` | Prior-auth check for Emerson Specimen (case_009, Aetna): readiness 'Qualifies if charted', 38 of 42 days charted, earliest Jul 31 against the planned Aug 3. | Narrator (Matthew): "Before a request goes out, the same checks run on the prior auth. Aetna needs six weeks of therapy and the chart shows thirty-eight days, so code works out the earliest date it qualifies." |
| 2:14–2:29 | `how` | The in-app How it works page scrolls on the left; a night band wipes in on the right: NVIDIA Nemotron on Nebius Token Factory reads and matches, Tavily finds Aetna's policy live, code decides. | Narrator (Matthew): "Under the hood, NVIDIA Nemotron on Nebius Token Factory reads the letter and matches the rules, and Tavily finds Aetna's current policy at runtime. But code, not the model, decides verdicts, deadlines, and whether a quote is real." |
| 2:29–2:44 | `proof` | Eval card labelled 'Our synthetic test set (30 cases)': 30/30 recommendations, 138/138 rule statuses, $0.048 per case. | Narrator (Matthew): "On thirty synthetic cases we wrote ourselves, it got every recommendation and all 138 rule statuses right, at about five cents a case. That's the pipeline working as designed, not accuracy on real charts." |
| 2:44–2:56 | `close` | Demo URL on the yellow card, repo link, 'Denial Auditor, by Road House'. Synthetic data only. | Narrator (Matthew): "Those appeals are worth filing, and now a small practice has the time. Try the live demo below. Denial Auditor, by Road House. Thanks for watching." |

Total: 2:56 with padding (163.23 s of speech). Subtitles are burned in from `video/src/cut/subs.json` (`video/scripts/subtitles.py`).

## Sources for every claim
- 80.7% / 11.5% / 2024 / Medicare Advantage prior auth: `docs/facts.md`, KFF, Jan 28, 2026.
- Maya, her clinic and her "eight new denials" are fictional (the demo workspace has eight open synthetic denials).
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
