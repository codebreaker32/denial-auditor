---
name: Denial Auditor
description: Imaging denials, marked up. Policy and chart shown as photocopies, evidence highlighted on them.
colors:
  copier-ground: "#DFE1DE"
  photocopy-paper: "#F3F4F1"
  paper-edge: "#CDD0CC"
  toner-ink: "#161817"
  graphite: "#3E433F"
  pencil: "#5E645F"
  rule-grey: "#C5C9C4"
  rail-ink: "#E9EAE7"
  rail-dim: "#9EA49F"
  highlighter-yellow: "#F5E62E"
  highlighter-green: "#8BEA7B"
  highlighter-pink: "#FF7FB6"
  highlighter-orange: "#FFB44D"
  highlighter-grey: "#C9CCC7"
  deadline-magenta: "#A1004A"
  strike-magenta: "#C2185B"
  focus-blue: "#1F4FFF"
typography:
  display:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    fontFeature: "tnum"
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  document:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.62
    fontFeature: "tnum"
  label:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "tnum"
  address:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
    fontFeature: "tnum"
rounded:
  sheet: "3px"
  inner: "4px"
  control: "6px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  stage: "34px"
components:
  button-primary:
    backgroundColor: "{colors.toner-ink}"
    textColor: "{colors.photocopy-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.toner-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-ghost-hover:
    backgroundColor: "{colors.photocopy-paper}"
  segmented-option:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.inner}"
    padding: "6px 11px"
  segmented-option-active:
    backgroundColor: "{colors.toner-ink}"
    textColor: "{colors.photocopy-paper}"
  input:
    backgroundColor: "{colors.photocopy-paper}"
    textColor: "{colors.toner-ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.rail-dim}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
  nav-item-active:
    backgroundColor: "{colors.highlighter-yellow}"
    textColor: "{colors.toner-ink}"
  rule-card:
    backgroundColor: "{colors.photocopy-paper}"
    textColor: "{colors.toner-ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  document-sheet:
    backgroundColor: "{colors.photocopy-paper}"
    textColor: "{colors.toner-ink}"
    typography: "{typography.document}"
    rounded: "{rounded.sheet}"
    padding: "26px 40px 40px 72px"
---

# Design System: Denial Auditor

## Overview

**Creative North Star: "Highlighter on Photocopy"**

The denial file, marked up. The app is a copier-grey desk with a toner-black rail down the left; on it sit photocopied sheets (the payer's policy, the chart notes, the denial letter, the appeal) and every verdict is a fluorescent highlighter stroke laid over the exact sentence that decides it. The highlighter is not decoration: it is the entire state system. Green supports, pink blocks, orange is missing documentation, yellow is a quoted policy line (and "you are here"), grey is not applicable.

Density is that of a working desk, not a dashboard: a deadline board ranked by days left, a rule ledger beside a document sheet, a citation gate beside an editor. Type splits by material: Public Sans (a US federal-forms face) for the application, Source Serif 4 for anything that is a document. Figures are tabular everywhere, because deadlines, dates and costs are read in columns. Every quote carries a catalogue address (`L34220 · S47`, `note n1 · 07/20/2026`) and those addresses are links, so addresses are the navigation between rule, policy and chart.

The ground is cool, never cream. Depth is a sheet resting on a desk: one soft paper shadow, toner grain, a faint fax strip across the top edge. Motion is a single gesture, the highlighter sweep.

**Key Characteristics:**
- Cool copier-grey ground with faint toner speckle; toner-black rail.
- Fluorescent highlighter strokes, multiply-blended, as the only status colour.
- Marker shapes with ragged, asymmetric ends; never bordered pills.
- Public Sans for the app, Source Serif 4 for documents; tabular figures throughout.
- Catalogue addresses on every quote, and they link.
- One paper shadow; documents get grain, edge darkening and a copier strip.

## Colors

A near-neutral, slightly green-grey copier palette carrying five fluorescent highlighters and almost nothing else.

### Primary
- **Toner Ink** (toner-ink): body text, the left rail background, primary buttons, the active segmented option, the active tab underline, the selected rule's border. It is both ink and furniture.

### Secondary
- **Highlighter Yellow** (highlighter-yellow): quoted policy text in letters and the gate, the active nav item, the brand mark stroke, text selection, the "in progress" step, the fix-and-resubmit verdict.
- **Highlighter Green** (highlighter-green): criterion met / supports; the appeal verdict; completed live-run steps.
- **Highlighter Pink** (highlighter-pink): not met / blocks; don't-appeal-yet verdict; failing gate status; the wash behind a struck quote (35% mix).
- **Highlighter Orange** (highlighter-orange): missing documentation; ask-the-physician verdict; the synthetic-data banner swatch.
- **Highlighter Grey** (highlighter-grey): not applicable, route-only rules, not-winnable verdict.

### Tertiary
- **Deadline Magenta** (deadline-magenta): the deadline number when a case is due soon, on the board and in the case band. Text colour only.
- **Strike Magenta** (strike-magenta): the 2px line-through on a quote that failed verification.
- **Focus Blue** (focus-blue): 2px focus outline, offset 2px. The only cool hue in the system, reserved for keyboard focus.

### Neutral
- **Copier Ground** (copier-ground): the page behind everything, overlaid with a 5% fractal-noise speckle.
- **Photocopy Paper** (photocopy-paper): every surface that holds content: sheets, rule cards, the board, panels, inputs, the segmented control.
- **Paper Edge** (paper-edge): hover border on rule cards.
- **Graphite** (graphite): secondary text, ledes, rationale lines.
- **Pencil** (pencil): tertiary text, addresses, table headers, sentence numbers; holds 4.5:1 on paper.
- **Rule Grey** (rule-grey): hairlines, input and ghost-button borders, dashed evidence dividers.
- **Rail Ink / Rail Dim** (rail-ink, rail-dim): text on the black rail, active-hover and resting.

### Named Rules
**The Highlighter Is The State Rule.** Status is shown only by the five highlighters, laid as a stroke with `mix-blend-mode: multiply` over paper. No other hue carries meaning except deadline magenta (urgency), strike magenta (failed quote) and focus blue (keyboard).

**The Never Colour Alone Rule.** Every highlighter swatch sits beside a word ("Supports", "Missing documentation", "Every quote verified"). A colour without its word is a defect.

**The Cool Paper Rule.** Ground and paper stay cool green-grey. Cream, beige or warm paper breaks the photocopy.

## Typography

**Display Font:** Public Sans (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Public Sans for the application; Source Serif 4 (with Georgia, serif) for documents
**Label/Mono Font:** none; addresses are Public Sans at label size with tabular figures

**Character:** A plain federal-forms sans that reads like an administrative instrument, against a book serif that reads like the paper being audited. The split is by material, not by hierarchy.

### Hierarchy
- **Display** (700, 34px, 1.05, -0.025em): the case decision line ("Appeal") and its deadline number. 27px under 760px.
- **Headline** (700, 30px, 1.1, -0.02em): page titles ("Denials to work").
- **Title** (700, 18px): sheet headers and section heads in "How it works"; 15px for gate and letter sub-heads.
- **Body** (400, 15px, 1.5): application text; ledes capped at 70ch, decision rationale at 75ch.
- **Document** (400, 16px, 1.62, Source Serif 4): policy sheets, chart notes, letters, evidence quotes on rule cards (14px), gate quotes (13.5px), editor (15.5px). Paragraphs capped at 72ch.
- **Label** (600, 13px): status marks, field labels, side headings, tabs (600 at body size). Sentence case, never uppercase.
- **Address** (500, 12px, 0.01em): catalogue addresses, table headers, copier strip, legal line. Sentence numbers in the sheet margin drop to 11px.
- **Board figure** (700, 22px, -0.02em, line-height 1): days-left on the worklist, with an 11.5px date beneath.

### Named Rules
**The Two Materials Rule.** If it was fetched, written, or will be sent (policy, chart, letter, quote), it is set in Source Serif 4. Everything the app says about it is Public Sans.

**The Tabular Rule.** `font-variant-numeric: tabular-nums` is set at the root and never turned off. Dates, days-left, costs and sentence numbers align in columns.

**The No Shouting Rule.** No uppercase labels, no letter-spaced small caps. Hierarchy comes from weight and size.

## Layout

A two-column shell: a 208px sticky toner rail and a stage padded 18px / 34px / 28px. A thin synthetic-data note sits at the top of every stage; the AMA/attribution legal line closes it.

- **Worklist:** a filter segmented control and an "as of" address over one full-width paper board (table). Rows are fixed columns; the due cell carries a horizontal wash of the row's highlighter (30% fading to transparent), so rows restyle by state without breaking the grid.
- **Case:** a band (patient, payer, codes, dates; decision line; rationale) with primary actions right-aligned, then a workspace of a sticky rule ledger (330 to 410px) beside tabbed document sheets (gap 22px).
- **Appeal:** editor or rendered letter beside a 340px sticky citation gate (gap 18px).
- **Live:** form panel (280 to 420px) beside progress (gap 24px).
- **Rhythm:** 6 / 10 / 14 / 18 / 22px steps; cards pad 12px 14px; panels 18px 20px; sheets 26px 40px 40px 72px, the 72px left margin holding sentence addresses.
- **Responsive:** at 1100px the workspace and appeal collapse to one column and stickiness drops. At 760px the rail becomes a sticky top bar of icon-only nav (labels kept for screen readers), the board hides the reason column and stacks secondary data inside cells, the decision line stacks, and sheets pad 22px 18px 26px 44px.

## Elevation & Depth

Flat paper on a desk. One shadow, the sheet shadow, is used for every resting surface (board, rule cards, facts, panels, gate, sheets, editor, letter image); nothing lifts on hover. Document sheets add material rather than height: an inset vignette, a 16% toner-grain noise, a faint left/right edge darkening, and a copier strip across the top.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 1px rgba(22,24,23,.06), 0 6px 18px -8px rgba(22,24,23,.22)`): every paper surface at rest.
- **Photocopy vignette** (`inset 0 0 46px rgba(22,24,23,.07)`, layered with Sheet): document sheets only.

### Named Rules
**The One Sheet Rule.** There is one elevation. Selection and hover change borders or fills, never shadow depth.

## Shapes

Two corner families. Documents (sheets, editor, letter image) use a tight 3px, like trimmed paper. Application surfaces and controls (buttons, inputs, cards, board, panels, nav items) use 6px; nested options in the segmented control use 4px.

Highlighter marks use deliberately uneven radii so they read as hand-drawn strokes: inline highlights `3px 8px 4px 9px / 8px 4px 9px 3px` with a 100-degree gradient that thins at both ends; status swatches 22 by 11px at `2px 6px 3px 7px / 6px 3px 7px 2px`, skewed -8deg; small swatches (banner, steps) `2px 5px 3px 6px`. Inline highlights clone across line breaks.

Dashed lines mean "secondary or folded": evidence dividers on rule cards, separators between chart notes, and the folded-background button in a sheet.

## Components

### Buttons
Toner-black and unadorned; a working instrument.
- **Shape:** gently squared (6px).
- **Primary:** toner ink fill and 1px ink border, paper text, 600 weight, 9px 15px, optional 16px stroke icon at 2px.
- **Hover / Active:** fill lifts to #2B302D; press nudges down 1px on the out-expo ease (120ms).
- **Ghost:** transparent with a rule-grey border; hover fills paper and darkens the border to pencil.
- **Disabled:** 45% opacity, not-allowed cursor. Export stays disabled until the citation gate passes.

### Status Mark (signature)
- **Style:** a short skewed highlighter swatch followed by a 600 13px word. The swatch is multiply-blended; the word stays ink (pencil for not-applicable and route).
- **Variants:** one per criterion status and one per verdict, mapped to the highlighters as in Colors.

### Highlighter Stroke (signature)
Inline highlight over a sentence, quote or verdict word, coloured by status. **Sweep:** when a rule is selected, its sentence and evidence strokes draw left to right by animating background-size from 0 to 100% (320ms, `cubic-bezier(.16,1,.3,1)`). Disabled under reduced motion.

### Cards / Containers
- **Rule card:** paper, 6px, 12px 14px, Sheet shadow, 1px transparent border; hover border paper-edge; selected border toner ink. Status mark and address on the top row, a 500 summary, a 13px graphite rationale, then serif evidence quotes under dashed dividers, each with a linked address.
- **Facts / Panel / Gate:** paper, 6px, Sheet shadow; facts list labels in pencil 12px above values.
- **Board:** paper table, 6px, header in pencil 12px 600 over a rule-grey hairline; row hover #EAECE8; whole row is the link.

### Document Sheet (signature)
Paper with 3px corners, Sheet plus vignette, toner grain, serif 16/1.62. A copier strip runs across the top edge, including the margin ("Copy of fetched source — CMS Coverage API" left, fetch date and sentence count right, 12px pencil on a 4.5% ink wash). A sans header carries the title and a catalogue address. Sentence numbers (`S24`) sit in the 72px left margin. Runs of non-rule sentences collapse into a dashed fold button with "Show".

### Citation Gate and Struck Quote
Sticky gate panel: title with a pass/fail status mark, a count line, a list of serif quotes with their source address. A failed quote loses its highlight and takes a 2px strike-magenta line-through over a 35% pink wash; "Source says:" follows with the closest real sentence in yellow and its address.

### Inputs / Fields
- **Style:** paper fill, 1px rule-grey border, 6px, 9px 11px. Labels 600 13px above, 6px gap.
- **Focus:** border darkens to graphite; the global 2px focus-blue outline applies on keyboard focus. The appeal editor is a serif paper sheet (3px) with a focus-blue outline.

### Segmented Control and Tabs
- **Segmented:** paper track, 1px rule-grey border, 6px, 3px inset; options 4px, 500 weight, graphite; pressed option toner fill with paper text. Counts sit beside labels in 12px pencil.
- **Tabs:** 600 pencil text over a rule-grey baseline; selected tab is ink with a 3px inset ink underline.

### Navigation
Toner rail, 208px, sticky. Brand mark is a rail-ink line over a thick yellow highlighter stroke. Items are 19px stroke icons (1.7px) with 500 labels in rail-dim; hover lifts to rail-ink on #242826; the current page is a yellow highlighter fill with ink text. Rail foot carries the team line. Under 760px the rail becomes a top bar of icon-only items.

## Do's and Don'ts

### Do:
- **Do** carry every status as a highlighter swatch or stroke plus a word, multiply-blended over paper.
- **Do** give every quote a catalogue address (`L34220 · S47`, `note n1 · 07/20/2026`) and make it a link to its source.
- **Do** set fetched and outgoing text in Source Serif 4 and everything else in Public Sans, with tabular figures.
- **Do** use the single Sheet shadow for all resting paper; express selection with a toner-ink border.
- **Do** keep the 3px corner for documents and 6px for application surfaces and controls.
- **Do** respect reduced motion: the sweep and pulse switch off entirely.

### Don't:
- **Don't** render status as a bordered pill or a solid-colour badge; marks are ragged highlighter strokes.
- **Don't** introduce warm, cream or beige paper; the photocopy is cool grey.
- **Don't** use a status highlighter for decoration; yellow outside quotes is limited to the active nav item, brand mark, selection and in-progress step.
- **Don't** add elevation steps or hover lifts beyond the one Sheet shadow.
- **Don't** set labels in uppercase or letter-spaced caps.
- **Don't** use focus blue for anything but keyboard focus.
