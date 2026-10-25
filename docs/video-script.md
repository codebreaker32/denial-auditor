# Demo video script (target 2:45, hard limit < 3:00)

Recording rules:
- Synthetic data only, with the on-screen banner visible.
- No third-party music or logos, apart from the sponsor names said aloud.
- Say each statistic exactly as written in `docs/facts.md`.
- Record at 1440×900 against the deployed URL, not localhost.

| Time | Screen | Voiceover |
|---|---|---|
| 0:00–0:15 | Worklist, then slow scroll | "A three-doctor practice gets an MRI denial. In Medicare Advantage, 80.7% of appealed prior-auth denials were overturned in 2024, but only 11.5% were appealed. The work that wins appeals is reading, and nobody has time for it." |
| 0:15–0:30 | Worklist: point at Due, Recommendation and Model cost; the Policy watch line | "Denial Auditor reads every denial and ranks the board by what to do and how soon it's due. Every recommendation traces back to the payer's own sentences." |
| 0:30–0:50 | Open **case_015** (MA, x-ray demanded). Denial letter tab, then the band | "This plan denied an MRI because there was no x-ray first. Nemotron 3.5 Super-VL reads the faxed notice. A reason-code table routes it to clinical review, with no model involved." |
| 0:50–1:15 | Policy tab: highlighted sentences, a fold, the "L34220 v40, eff 10/23/2025" citation | "It fetches the Medicare policy in effect on the date of service from the CMS Coverage API. Code numbers every sentence, and Nemotron 3 Super only picks sentence numbers, so every rule is the payer's own wording." |
| 1:15–1:40 | Click a rule card: linked highlight jumps to the chart note; open "Why?" and its votes | "Each rule is checked against the chart by two Nemotron Super votes. When they disagree, Nemotron Ultra decides. Every chart quote is found in its note by code, and durations come from dates. Nothing in the policy requires an x-ray first." |
| 1:40–2:05 | Decision map, then Appeal tab: typeset letter and the gate panel all green | "A fixed rule, not a model, says appeal. Ultra drafts, Super critiques it as the payer's reviewer, and Ultra revises. The citation gate checks every quote against the fetched sources." |
| 2:05–2:20 | **Edit text**: change "four weeks" to "two weeks"; the quote turns pink, the source sentence shows, Export is disabled | "Change one word and export locks, showing what the source really says. A person always sends the letter." |
| 2:20–2:35 | Before you submit → **case_009** (Aetna, 38 of 42 days), earliest date | "Before a request goes out, the same checks run on the prior auth. Here Aetna needs six weeks of therapy and the chart documents 38 days, so it gives the earliest date, worked out in code." |
| 2:35–2:45 | How this was decided: model calls and cost; then the README eval table | "About five cents a case on average, on Nemotron through Nebius Token Factory, with Tavily finding the payer's current policy at runtime. 30 out of 30 on our synthetic test set. Denial Auditor, by Road House." |

**Shot list before recording:** run the live demo once (for the Tavily call on screen, optional); clear the gate edit between takes; keep the browser zoom at 100%.

**Don't say:**
- "never trained on";
- "HIPAA compliant";
- "real patients";
- any statistic that isn't in `docs/facts.md`;
- that it submits appeals.
