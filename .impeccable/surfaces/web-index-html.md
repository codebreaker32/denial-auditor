---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: []
---

# Surface brief: Denial Auditor web app (worklist, case, before you submit, live run, how it works)

Scope: the whole working app. Visitor mode: **Operate**.
Audience/job: a billing specialist at a small practice working a queue of imaging denials against deadlines, in long sessions; decide, gather evidence, act. Secondary: judges watching a sub-3-minute video.
User asks (2026-10-26): "Didn't like deck and submission. /impeccable pick some next-level design that fits with the product. same goes for UI-UX and use taste-skill-v2 for anti AI slop." Answers: everything was too dark and gloomy, generic, too much text, no wow moment; energy bold and graphic; light or dark left to the direction. Chosen on the decision page: Red Drop-out Claim Form (impeccable's pick card). Standing rule: /impeccable for UI, taste-skill-v2 for anti-slop (framed-sheet app style, `lint.mjs --app`, `inspect.mjs --app`).
Constraints: synthetic data banner; CPT bare codes + AMA line; export locked until every quote verifies; a person sends; status never by colour alone.
Build path: code-led (no image generation in this environment).

## Direction contract

THESIS: The app is printed like the claim itself: the form's structure (numbered field boxes, condensed caps labels, column heads, rules) in drop-out red, everything the case supplies typed in black. It refuses the dark data-terminal and graphite looks, the generic white SaaS kit, and any costume of the form over standard controls.

OWN-WORLD: White sheet on a pale drop-out pink frame (#F8E1E6), drop-out red #C8262B for labels and box numbers, line-red #F1C4C1 for field rules, typed black #141414, greys #4E4A49/#6E6766. Archivo (condensed caps for printed labels) for words; Courier Prime only for typed entries: IDs, codes, dates, figures, the answer word. Status: green and amber on tints; red is the form, so "blocks/not yet/VOID" are black reversed. Tight radii (4px cards, 10px sheet).

STORY: The biller opens the worklist (column heads A–E printed like the form's service lines), opens a case, reads boxes 1–3 (answer, appeal window, next step) and boxes 4–7 (the coverage path), checks rules beside the policy, and exports only when every quote's box carries its X.

FIRST VIEWPORT: Case view. Tinted frame with sidebar and context line; white sheet holding the breadcrumb, the three-box header row ruled in red, the why-line and meta, the four-box coverage row, then the rules ledger (380px) beside the tabbed policy sheet with its red sentence addresses.

FORM: Red drop-out claim form (CMS-1500), position 1 on the ordered list; chosen as the pick card over the roll (The Coverage Card). Seed key e6dbdb1e.

SIGNATURE MOVE: The checked box. A verified quote is a printed red square with a typed black X; in the citation gate the X's type in one after another as the check completes. The case header and coverage path are numbered form boxes 1–7. A tampered quote is struck through with a black VOID stamp and the source's own words shown beneath.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
