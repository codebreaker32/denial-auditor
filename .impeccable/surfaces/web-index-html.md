---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: []
---

# Surface brief: Denial Auditor web app (worklist, case, before you submit, live run, how it works)

Scope: the whole working app. Visitor mode: **Operate**.
Audience/job: a billing specialist at a small practice working a queue of imaging denials against deadlines, in long sessions; decide, gather evidence, act. Secondary: judges watching a sub-3-minute video.
User asks (2026-10-25): "Remove AI slop using taste-skill-v2 and improve color choice"; earlier pins: dark, Stripe/Mercury quality bar, less text, a flow that is easy to follow. Standing rule: /impeccable for UI, taste-skill-v2 for anti-slop (app-screen rules, `lint.mjs --app`, `inspect.mjs --app`).
Constraints: synthetic data banner; CPT bare codes + AMA line; export locked until every quote verifies; a person sends; status never by colour alone.
Build path: code-led (no image generation). Critique reference: the panel's mock captures (scratchpad/mock-out/{case,worklist,appeal}/desktop-fold.jpg).
Full spec: scratchpad/impeccable/final-spec.md (judge panel, 2026-10-25).

## Direction contract

THESIS: A claims desk read in long sessions: neutral graphite, colour only where a rule decides, and one blue-pencil mark on every line the code has checked against its source. It refuses the generated dashboard (KPI tiles, saturated chips, neon on black, hero headers) and the previous guide-map field.

OWN-WORLD: The taste-skill data-terminal neutrals: #171719 ground, #131217 cards one step darker, #222224 rules, soft ink #EDEDEF, and two greys far apart (#B4B4BA, #94949B). Status is a hue on its own dark tint, always with a glyph and a word: green #5FC39C, amber #D9A441, red #E5566F, neutral filled, neutral outlined. The face is the blue pencil #8EC5E8, used only for "verified against fetched text". Public Sans throughout, IBM Plex Mono for IDs only, six sizes, weights up to 600. Full-round controls, 6px cards, and an inverted ink primary.

STORY: The biller opens the worklist sorted by days left and reads the finding sentence. They open a case and read the coloured answer word, the deadline with its appeal-window runway, and the one primary action. They check the coverage path and the rules beside the policy (rule sentences bright, background prose grey). They export only when every quote carries the blue verified mark.

FIRST VIEWPORT: Case view. A labelled 224px sidebar (brand mark, Worklist with count, Before you submit; Run live and How it works at the foot) and a context line (synthetic note, policy watch stamp). The main column holds:
- the breadcrumb (Worklist / patient h1 / Case id);
- the verdict line: a coloured 28px answer word with its glyph, the deadline cell (figure, runway, Notice/Due, CFR source), and the one primary on the right;
- the why-line and meta line;
- the coverage path (four stages, "Decided by a fixed rule, not a model");
- the rules column (400px) beside the tabbed policy sheet with its sentence gutter.

FORM: Taste-skill-v2 app style data-terminal, seed 1818343043, pinned by the user's request and chosen by a judge panel (mercury "Blue pencil" proposal, 23.9/30). No impeccable concept roll; the direction is pinned.

SIGNATURE MOVE: The blue pencil. A tick-and-tie mark sits on every chart quote and appeal quote the code has verified against its source, so it is the only hue that states a fact. The coverage path shows the payer's decision order with the addresses that decided each stage. A tampered quote becomes VOID (a red-edged tint pair, struck text, "Source says"), and Export locked states its reason.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
