---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: []
---

# Surface brief: Denial Auditor web app (worklist, case, live run)

Scope: the whole working app (worklist → case evidence board → appeal / next step; live run). Visitor mode: **Operate**.
Audience/job: a billing specialist at a small practice working a queue of imaging denials against deadlines; decide, gather evidence, act.
Constraints: synthetic data banner; CPT bare codes + AMA line; export locked until every quote verifies; human sends.
Build path: code-led (no image generation available).

## Direction contract

THESIS: The denial file, marked up. Every verdict is a highlighted sentence you can trace: the app shows the payer's own policy text and the chart as photocopied documents, and evidence is literally highlighted on them. Refuses the category default: sidebar + KPI cards + generic table + chat panel.

OWN-WORLD: Cool photocopy-grey paper ground (not cream), toner-black ink and a toner-black app rail, fluorescent highlighter as the entire state system: yellow = policy quote, green = met/supports, pink = blocks/not met, orange = missing documentation, grey = not applicable. Highlights are multiply-blended marker strokes with slightly ragged ends, never pills with borders. Public Sans for UI (US federal-forms lineage), Source Serif 4 for document text, tabular figures everywhere. Catalogue addresses on every quote: `L34220 · S47`, `note n3 · 07/01/2026`.

STORY: The biller sees which denials to work first (deadline board), opens one, understands in one glance whether to appeal and why (the rules list, each tied to highlighted sentences), checks any claim against its source, and exports a letter only when every quote verifies.

FIRST VIEWPORT: Case view. Left: black rail (Worklist, Case, Run live, How it works). Top band: patient + payer + DOS, verdict stated as one decision line with the deadline number large ("Appeal · 43 days left · due 11/05/2026"). Main split: left column the rule ledger (status highlight swatch + plain summary + address), right column the photocopied policy page with the matched sentences highlighted in their status colours and sentence addresses in the margin. Primary action (Draft appeal / Request docs) top-right of the band.

FORM: Highlighter on photocopy, my grounded candidate 6 (assigned), seed key fdbf0a84. Raise from split-flap concourse (declined): worklist as a fixed-column board ranked by deadline, tabular figures, rows restyle by state without breaking the grid. Raise from Factory catalog sleeve (declined): every quote carries a catalogue address; addresses are the navigation between rule, policy and chart.

SIGNATURE MOVE: Hovering or selecting a rule sweeps a highlighter stroke across its exact sentence in the policy pane and its evidence sentence in the chart pane (left-to-right, 280 ms, respects reduced motion). In the appeal editor, a tampered quote loses its highlight and gets a pink strike with the source sentence shown beside it.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
