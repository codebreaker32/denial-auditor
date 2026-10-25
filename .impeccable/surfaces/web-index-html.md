---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: []
---

# Surface brief: Denial Auditor web app (worklist, case, before you submit, live run)

Scope: the whole working app (worklist → case → appeal / next step; before you submit; live run; how it works). Visitor mode: **Operate**.
Audience/job: a billing specialist at a small practice working a queue of imaging denials against deadlines; decide, gather evidence, act. Secondary: judges watching a sub-3-minute video.
User answers (2026-10-25): disliked the photocopy look entirely; too much text; felt like a prototype; flow hard to follow; "looks like AI slop". Quality bar **Stripe / Mercury**. Theme **dark**.
Constraints: synthetic data banner; CPT bare codes + AMA line; export locked until every quote verifies; a human sends.
Build path: code-led (no image generation available).

## Direction contract

THESIS: Every denial is an area on one map, and its verdict is the colour of the land. The case opens on a single flat field of colour (green appeal, coral don't appeal yet, sun ask the physician, pond fix and resubmit, lilac not winnable) whose coastline does the dividing, so the answer is read before a word is. Refuses the category default: grey dashboard, KPI cards, a neon accent, and text-heavy cards.

OWN-WORLD: The guide-map palette translated to night (named translation: the map's cream water becomes a near-black ink-green ground, and cream becomes the text colour). Flat, unmodulated colour only, with no gradients, glow or grain: land #8ED462, coral #FF6B5A, sun #FFD23F, pond #4FA6E3, lilac #EBC1FF, ink #1B1D1A on colour. One grotesk (Hanken Grotesk); display bold at 0.95 leading and -0.05em; tabular figures. Controls are capsules; the primary capsule carries a round ink chip with an arrow on its trailing edge, and a selected filter's chip crosses to the leading edge. Everything that moves takes 0.4s and overshoots before settling.

STORY: The biller sees the board as coloured areas (counts per verdict that double as filters) and a table ranked by days left. They open a case and know the answer from the colour field. They check each rule (a capsule, one line, one quote) against the source, and export only when every quote verifies.

FIRST VIEWPORT: Case view. A standard left sidebar (brand lobe, Worklist, Case, Before you submit, Run live, How it works). The top is the verdict field: a flat colour lobe across the main column, its lower edge a drawn coastline. On it, in ink: patient and payer on one line, the verdict word at about 64px, days left as a monumental figure, and the primary capsule (Review appeal / Copy request) at right. Below, on the dark ground, the rules column (capsule status + one-line summary + first quote) beside tabbed source documents (Policy, Chart notes, Letter, Next step), with verified sentences filled flat in their status colour.

FORM: Zoo and gardens guide map, a catalog challenger (aww2-zoo-gardens-guide-map) the user adopted over the assigned Exhibit Binder, seed key 00066ded. Translated to dark per the user's pin.

SIGNATURE MOVE: The verdict coastline. One SVG path, seeded by the case id, draws the verdict field's coast. Moving between cases or tabs morphs it (0.4s, overshoot) and recolours it. A tampered quote in the appeal turns its fill coral, gets a VOID capsule, and locks export.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
