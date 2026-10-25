---
name: Denial Auditor
description: Blue pencil on the claims desk. Neutral graphite for long sessions, colour only where a rule decides, and one blue mark on every line the code has checked against its source.
colors:
  ground: "#171719"
  surface: "#131217"
  raised: "#212023"
  raised-2: "#2A2A2E"
  rule: "#222224"
  border: "#28282C"
  control: "#3A3A3E"
  field: "#6A6A72"
  text: "#EDEDEF"
  muted: "#B4B4BA"
  faint: "#94949B"
  primary: "#EDEDEF"
  primary-ink: "#171719"
  primary-hover: "#FFFFFF"
  primary-press: "#D6D6DA"
  verified: "#8EC5E8"
  verified-tint: "#172430"
  positive: "#44A282"
  positive-ink: "#5FC39C"
  positive-tint: "#1B2828"
  positive-hl: "#204139"
  warning: "#D9A441"
  warning-ink: "#D9A441"
  warning-tint: "#2A2416"
  warning-hl: "#413720"
  negative: "#E5566F"
  negative-ink: "#E5566F"
  negative-tint: "#2C1A20"
  negative-hl: "#48232C"
typography:
  answer:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "36px"
    fontFeature: "tnum"
  headline:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  reading:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "26px"
  body:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "tnum"
  label:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  micro:
    fontFamily: "Public Sans, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  id:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "inherit"
    fontWeight: 400
    letterSpacing: "0"
rounded:
  mark: "3px"
  card: "6px"
  control: "999px"
spacing:
  base: "4px"
  card-pad: "20px"
  gap: "24px"
  pad: "32px"
  pad-phone: "16px"
  control-h: "36px"
  field-h: "40px"
  pill-h: "22px"
  row-h: "60px"
  sidebar: "224px"
  ledger: "400px"
  gate: "360px"
  deadline-w: "360px"
  gutter-sentence: "88px"
  read: "72ch"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "{spacing.control-h}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-ink}"
  button-primary-active:
    backgroundColor: "{colors.primary-press}"
    textColor: "{colors.primary-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "{spacing.control-h}"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  button-locked:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.faint}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  pill-positive:
    backgroundColor: "{colors.positive-tint}"
    textColor: "{colors.positive-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.control}"
    padding: "0 10px 0 8px"
    height: "{spacing.pill-h}"
  pill-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.control}"
    padding: "0 10px 0 8px"
    height: "{spacing.pill-h}"
  pill-negative:
    backgroundColor: "{colors.negative-tint}"
    textColor: "{colors.negative-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.control}"
    padding: "0 10px 0 8px"
    height: "{spacing.pill-h}"
  pill-filled-neutral:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.text}"
    typography: "{typography.micro}"
    rounded: "{rounded.control}"
    padding: "0 10px 0 8px"
    height: "{spacing.pill-h}"
  pill-outlined-neutral:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.micro}"
    rounded: "{rounded.control}"
    padding: "0 9px 0 7px"
    height: "{spacing.pill-h}"
  pill-verified:
    backgroundColor: "{colors.verified-tint}"
    textColor: "{colors.verified}"
    typography: "{typography.micro}"
    rounded: "{rounded.control}"
    padding: "0 10px 0 8px"
    height: "{spacing.pill-h}"
  void-tag:
    backgroundColor: "{colors.negative-tint}"
    textColor: "{colors.negative-ink}"
    rounded: "{rounded.control}"
    padding: "0 7px"
    height: "20px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0 12px"
    height: "{spacing.field-h}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.reading}"
    rounded: "{rounded.card}"
    padding: "24px 32px 32px 0"
  rule-row-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "12px"
  evidence-supports:
    backgroundColor: "{colors.positive-hl}"
    textColor: "{colors.text}"
    rounded: "{rounded.mark}"
  evidence-missing:
    backgroundColor: "{colors.warning-hl}"
    textColor: "{colors.text}"
    rounded: "{rounded.mark}"
  evidence-blocks:
    backgroundColor: "{colors.negative-hl}"
    textColor: "{colors.text}"
    rounded: "{rounded.mark}"
  evidence-not-applicable:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.mark}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0 8px"
    height: "32px"
  nav-item-current:
    textColor: "{colors.text}"
  table-row:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    padding: "0 12px"
    height: "{spacing.row-h}"
---

# Design System: Denial Auditor

## Overview

**Creative North Star: "Blue pencil on the claims desk"**

A claims desk read in eight-hour sessions. The ground is neutral graphite, text is a soft ink rather than white, and two greys sit far apart so prose, sublines and labels separate without colour. Colour appears only where a rule has decided something: a status hue on its own dark tint, always paired with a glyph and a word. One more hue, the blue pencil, is the auditor's non-photo-blue tick: it appears on every line the code has checked against text fetched for this case, and nowhere else.

The system is a taste-skill-v2 data-terminal app style (seed 1818343043), redrawn for legibility: a labelled sidebar instead of an icon rail, 14/20 body instead of 13, a 1px border on cards instead of a shadow, and ink (not the hue) for selection and focus. Density is a working tool's density: 60px table rows, ruled groups rather than boxes, one primary action per screen in inverted ink.

It refuses the generated dashboard: no KPI tiles, saturated chips, neon on black, hero headers or large status-tint areas. Motion is feedback only.

**Key Characteristics:**
- Graphite ground, cards one tone step darker, every line 1px.
- One hue, one meaning: blue pencil means "verified against fetched text".
- Status is hue + glyph + word, on its own dark tint; never colour alone.
- Public Sans for every word and figure; IBM Plex Mono for IDs only, at the size of its line.
- Six type sizes, weights 400/500/600, sentence case, no tracked capitals.
- Full-round controls and pills, 6px cards, one inverted-ink primary.

## Colors

A near-monochrome graphite palette with three status hues on dark tints and a single factual blue.

### Primary
- **Blue Pencil** (verified, #8EC5E8): the product's one hue. It marks text the code has matched against a source fetched for this case: the tick-and-tie glyph before every verified chart quote and appeal quote, the brand mark and favicon, the gate's pass pill ("N of N match their source", on Blue Pencil Tint #172430), the 1px rule beside block quotes in the letter, the 1px underline on inline letter quotes, and the treatment bars on the chart timeline.
- **Soft Ink Primary** (primary, #EDEDEF; label primary-ink #171719; hover #FFFFFF; press #D6D6DA): the one primary button per screen, inverted. Ink is also the colour of focus rings and selection lines.

### Status
Each status hue has four roles: the hue (glyphs, chart lines), `-ink` (words), `-tint` (pill grounds), `-hl` (evidence span fill).
- **Ledger Green** (positive #44A282, ink #5FC39C): Supports, Appeal, Ready to submit, Done, threshold met.
- **Docket Amber** (warning #D9A441): Missing docs, Ask the physician, Add documentation first, Policy changed, due soon.
- **Denial Red** (negative #E5566F): Blocks, Don't appeal yet, Not yet, VOID, overdue, threshold not met.
- **Filled neutral** (raised-2 #2A2A2E with soft ink): Fix & resubmit.
- **Outlined neutral** (control #3A3A3E edge, muted ink): Not winnable, Doesn't qualify, Not applicable, Route not used, Checking quotes.

### Neutral
- **Graphite Ground** (ground, #171719): the page, sidebar, tables and the rules ledger.
- **Card Graphite** (surface, #131217): cards, sheets, the gate and panels, one step darker than the ground (1.04:1, so they always carry a 1px border).
- **Raised** (#212023) and **Raised 2** (#2A2A2E): selected rule row, fold rows, disabled buttons, skeletons; Raised 2 is also the runway track, the timeline grid and the filled-neutral pill.
- **Lines** (rule #222224, border #28282C, control #3A3A3E, field #6A6A72): row and tab rules, card edges, secondary outlines and hover outlines, and input edges (the only line held to 3:1). Structural lines stay under 1.9:1.
- **Soft Ink** (text, #EDEDEF), **Muted** (#B4B4BA), **Faint** (#94949B): body and figures; background prose and sublines; labels, IDs, captions, table headers.

### Named Rules
**The One Hue, One Meaning Rule.** Blue Pencil means "checked by code against text fetched for this case" and nothing else. It never marks selection, focus, buttons, tabs, nav, headings, links or the text-selection highlight. Selection lines and focus rings are ink; text selection is ink on Control grey (#3A3A3E).

**The Hue Plus Glyph Plus Word Rule.** A status is never a colour alone. Every pill, answer word, gutter status word and coverage stage carries its glyph and its word. The five verdicts differ by glyph, and the two neutrals differ by filled versus outlined.

**The Colour Only Where A Rule Decides Rule.** Colour sits only on the answer word and its glyph, pills, coverage glyphs and the holding stage's pill, gutter status words, evidence spans, the VOID block, chart marks, timeline bars, due-soon and overdue figures, the brand mark and verified ticks. Never on the ground, sidebar, nav, tabs, headings, buttons, links, borders, filters or table headers. Strongly coloured pixels stay under 3% of any first screen.

**The One Red Per Object Rule.** On a worklist row whose pill is red, the due figure stays ink. Due-soon and overdue colour applies only to actionable verdicts (Appeal, Ask the physician, Fix & resubmit); Not winnable figures are always Muted.

### Contrast lint notes (AVOID)
- The only text on any `-hl` tint is `--text`.
- `--negative` text goes only on `--ground`, `--surface` or `--negative-tint`.
- `--faint` never goes on anything lighter than #2A2A2E.
- #8A8C92 and #FFF are never used for text.
- No hue doubles as focus, selection or text selection.

## Typography

**Display Font:** Public Sans (variable, self-hosted `web/fonts/public-sans-latin-wght-normal.woff2`, OFL; fallback Inter, system-ui)
**Body Font:** Public Sans
**Label/Mono Font:** IBM Plex Mono 400 (self-hosted `web/fonts/ibm-plex-mono-latin-400-normal.woff2`, OFL), for IDs only

**Character:** A plain, civic grotesque sets every word and every figure with tabular numerals, so dates, day counts and money line up in columns. The mono is a precise clerk's hand reserved for identifiers.

### Hierarchy
- **Answer** (600, 28/36, -0.015em): the case and check answer word ("Appeal", "Not yet") with its 24px glyph, coloured by verdict. It is a paragraph, not the h1. 24/32 on phone.
- **Figure** (400, 28/36): the deadline figure and the earliest-date figure. 24/32 on phone.
- **Headline** (600, 24/32, -0.01em): list-page h1s ("Denials to work", "Before you submit").
- **Title** (600, 16/24): the case h1 (the breadcrumb's current item), card and sheet h2s, the gate title, letter h3s. The worklist due figure is 16/24 at 500.
- **Reading** (400, 16/26, max 72ch): policy sentences, chart notes, the letter, the documentation request, How it works.
- **Body / Label** (400 or 500, 14/20): body, cells, nav, the why-line; 500 for buttons, tabs, form labels, rule summaries, patient names and stage results.
- **Caption** (400/500, 13/18): sublines, table headers, the context line, meta line, coverage labels, key-value wells, gate list, evidence quote lines.
- **Micro** (400/500/600, 12/16): pills (500), gutter IDs and status words (500), runway end labels, timeline labels, the legal footer, VOID (600). Nothing goes below 12px.

### Named Rules
**The Six Sizes Rule.** 28, 24, 16, 14, 13 and 12px, at weights 400, 500 and 600. Nothing at 700 or above, nothing under 12px.

**The Mono Is For IDs Rule.** IBM Plex Mono sets sentence addresses (S47), policy IDs (L34220 v40, CPB 0236), claim codes (CPT 72148, CARC 50) and case, chart and note IDs, always at `font-size: inherit` with tracking 0, so it takes the size of its line. Dates, days, money, citations, captions and prose are never mono. Mono stays under 15% of text.

**The Sentence Case Rule.** Sentence case and zero tracking everywhere, apart from the two negative values above. VOID is the only uppercase word.

## Layout

A 4px base. At 1440: a 224px sidebar, then 32px padding around an 1152px main column. A 36px context line (the synthetic-data note and the policy-watch stamp) sits above main as plain text.

The case view reads top to bottom: breadcrumb; the verdict line (answer word, the 360px deadline cell behind a 1px left rule, and the actions pushed right); the why-line and meta line; the coverage path; then the workspace, a 400px rules ledger beside the documents with a 24px gap. The appeal tab is the letter beside a 360px sticky gate. Policy sheets carry an 88px sentence gutter (address and status word) and a 72ch measure.

Tables and the rules ledger sit directly on the ground, grouped by 1px rules rather than boxed. Cards (key-value wells, sheets, the timeline, the gate, live panels) use 20px padding.

Responsive behaviour:
- **≤1100:** the sidebar becomes a 48px top bar with text-only nav and a 2px ink underline on the current item; the workspace, appeal, live and how-it-works grids go to one column; the gate becomes static; the worklist hides the service-date column.
- **≤760:** the verdict line stacks (the deadline loses its divider, actions take the full width); the coverage path goes 2 x 2; the sentence gutter shrinks to 64px.
- **≤640:** the phone shell, a 48px top row and a fixed 56px bottom bar (icon over label, 44px minimum targets, safe-area aware); 16px gutters; the primary goes full width at 44px; the coverage path becomes four rows; tables become two-column items; the gutter becomes an inline line above each sentence.

## Elevation & Depth

Flat. There are no shadows anywhere. Depth is a tone step plus a 1px line: cards sit one step darker than the ground (Card Graphite on Graphite Ground) and always carry a 1px Border edge; a selected row lifts to Raised. Hover is a 1px Control outline drawn inside the element, never a lift.

### Named Rules
**The Border Or Nothing Rule.** A card gets a 1px border, never a shadow, and never both.

## Shapes

Three radii: full-round (999px) for buttons, pills, the VOID tag and timeline bars; a gentle 6px for cards, sheets, inputs, nav items, rule rows and hover outlines; 3px for evidence spans and small label grounds. The runway is a 4px bar at 2px radius. Every line is 1px; the only 2px lines are ink selection indicators (tab underline, current-nav segment on the sidebar's right rule, the selected rule's bottom line, the selected span's underline) and the focus ring. There are no left accent bars.

Icons are stroked SVG on a 24px grid (`fill: none`, round caps and joins): stroke 2 at 12 to 16px, 2.25 at 24px, 1.5 for nav icons. The set is check, cross, half, pause, return, slash, dash, tick-and-tie, lock, chevron, download, copy and play.

## Components

### Buttons
Quiet and certain: one ink button per screen, everything else an outline or a word.
- **Shape:** full-round (999px), 36px minimum height, 8px 16px padding, 14/500, 16px glyph at 8px gap. Labels wrap rather than truncate.
- **Primary:** Soft Ink fill with Graphite label; brightens to white on hover and dims on press.
- **Secondary:** transparent with a 1px inset Control outline and ink label; Raised fill on hover.
- **Text:** Muted word that turns ink and underlines on hover.
- **Locked / disabled:** Raised fill with Faint label and a not-allowed cursor. Locked actions use `aria-disabled="true"`, not `disabled`, so they stay focusable and announce their reason.
- **Focus:** a 2px ink ring at 2px offset, restated after any hover outline.

### Chips (status pills)
- **Style:** 22px full-round pill, 12/500, a 12px glyph then the word, on its hue's dark tint in its `-ink`: positive, warning, negative; filled neutral on Raised 2 in ink; outlined neutral with a 1px Control edge in Muted; verified (gate pass only) in Blue Pencil on its tint.
- **State:** pills are statements, not controls; they have no hover.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** Card Graphite.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Border.
- **Internal Padding:** 20px; sheets 24px 32px 32px with the gutter; the letter 32px 40px.

### Inputs / Fields
- **Style:** 40px tall, 1px Field edge (3.34:1 on the ground), 6px radius, ground fill, ink text, Faint placeholder; labels at 14/500 above with an 8px gap.
- **Focus:** the 2px ink ring.

### Navigation
- **Sidebar (desktop):** labelled 224px rail on the ground with a 1px right rule: the brand mark in Blue Pencil, Worklist with its count, Before you submit; Run live and How it works at the foot. Items are 32px, 14px Muted with a 16px icon; hover and current turn ink, and the current item adds a 2px ink segment on the sidebar's right rule.
- **Top bar (≤1100), bottom bar (≤640):** see Layout.

### Tabs
Document tabs and worklist filters: 14/500 Muted words 24px apart over a 1px rule; hover and selected turn ink, and the selected tab carries a 2px ink underline. Counts follow in Faint at 400. No pills, no fills.

### Tables
Rows sit on the ground with no card: 60px rows divided by 1px rules, 13/18 Faint headers, a 14/500 ink first line over a 13/18 Faint subline. Hover draws a 1px Control outline around the whole row (6px radius) from the row's link; focus draws the 2px ink ring there. Missing values are an em dash.

### Case header
The breadcrumb ("Worklist / patient / Case id") with the patient name as the 16/600 h1. Below it, the verdict line: the coloured 28px answer word with its glyph, the deadline cell (figure and "days left", the appeal-window runway with the remaining span in ink or amber and a red tick when late, Notice and Due end labels, the CFR source line), and one inverted-ink primary on the right.

### Coverage path (signature)
The payer's own decision order (Route to coverage, Waiting periods, Restrictions, Documentation) as one row of four stages, ruled above and below by 1px lines and headed "Decided by a fixed rule, not a model". Each stage shows a 13px Faint label, its result word with a 14px glyph (ok in green, quiet in Muted), a 1px Control connector to the next stage, and the mono addresses of the sentences that decided it. The stage that holds the case up shows as its tint pill, never as a filled cell.

### Rules ledger and policy sheet
The ledger is a ruled list on the ground. Each rule row shows its summary at 14/500, its status pill, its address top right, and an evidence line with the Blue Pencil tick before each verified quote. Hover is the 1px outline; the selected row fills Raised with a 2px ink line on its bottom rule.

In the policy sheet, rule sentences rest in bright ink with their gutter status word, while background prose stays Muted. The `-hl` tint fill lands only on the selected rule's spans (`.on`, with a 2px ink underline); resting spans (`.rest`) carry no fill. Linked hover adds a 1px Muted underline. Long runs of non-rule sentences collapse into a Raised fold row.

### Chart timeline
A card with a 1px grid axis, month ticks in 12px Faint, treatment bars in Blue Pencil (12px, full-round), dashed threshold lines in green, red or Faint with labels, ink dot markers for chart notes and an ink diamond for the red-flag date.

### Appeal letter, citation gate, VOID, export
- **Letter:** 16/26 ink on a sheet. Inline quotes carry a 1px Blue Pencil underline and a tick with the mono address; block quotes carry a 1px Blue Pencil rule on the left and a "Verified · matches" caption.
- **VOID:** a tampered quote becomes a 12/600 uppercase VOID tag (negative tint with a 1px red edge), the struck text in Muted with a red strike, inside a negative-tint block, followed by a "Source says" block showing the verified source text.
- **Gate:** a sticky 360px card listing every quote with its tick or VOID, headed by the pass pill (Blue Pencil) or the fail pill (red). Export is the primary only when all quotes match; otherwise it reads "Export locked" with the lock glyph, `aria-disabled`, and its reason directly beneath.

### Motion
Feedback only: 120ms on `cubic-bezier(.2, 0, 0, 1)` for colour, background, outline and text-decoration colour. The only animated transform is the disclosure chevron rotating 90 degrees. Tab and selection lines appear in place; disclosures and folds open instantly; skeletons are flat. `prefers-reduced-motion: reduce` turns every transition, animation and smooth scroll off.

## Do's and Don'ts

### Do:
- **Do** put the Blue Pencil (#8EC5E8) tick-and-tie on every quote the code has verified against fetched text, and only there.
- **Do** pair every status hue with its glyph and its word, on its own dark tint.
- **Do** keep text on any `-hl` tint in `--text`, and fill a rule's spans only while that rule is selected.
- **Do** keep exactly one inverted-ink primary per screen; locked actions use `aria-disabled` with the reason beside them.
- **Do** set IDs in IBM Plex Mono at the inherited size, and everything else, figures included, in Public Sans with tabular numerals.
- **Do** separate surfaces with a tone step and a 1px line; draw hover as a 1px Control outline.
- **Do** keep motion at 120ms on `cubic-bezier(.2, 0, 0, 1)`, and off under reduced motion.

### Don't:
- **Don't** use the blue for selection, focus, buttons, tabs, nav, headings, links or the text-selection highlight.
- **Don't** put `--negative` text on anything but `--ground`, `--surface` or `--negative-tint`, or `--faint` on anything lighter than #2A2A2E.
- **Don't** use #8A8C92 or #FFF for text.
- **Don't** add shadows, left accent bars, large status-tint areas, KPI tiles, saturated chips or hero headers.
- **Don't** colour headings, the h1, buttons, links, borders, nav, filters or table headers.
- **Don't** use a sixth size outside 28/24/16/14/13/12, a weight above 600, tracked capitals or text under 12px.
- **Don't** set dates, days, money, captions or prose in mono.
- **Don't** animate position, scale or entrance; the chevron rotation is the only moving transform.

### Gate record
taste-skill-v2 gate at handoff (reported by the build, not re-run here): `inspect.mjs --app` 0 FAIL / 0 WARN on nine screens; `lint.mjs --app` 0 FAIL, with warnings only for mono IDs and missing-value dashes, both intended.
