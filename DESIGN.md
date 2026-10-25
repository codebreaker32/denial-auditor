---
name: Denial Auditor
description: The guide map, at night. Every denial is an area on one map, and its verdict is the colour of the land.
colors:
  ground: "#111410"
  surface: "#191D17"
  surface-2: "#22271F"
  stone: "#2F352B"
  line: "#2C3228"
  line-2: "#3B4236"
  text: "#F5F1E4"
  text-2: "#C8C6B8"
  text-3: "#9C9A8C"
  land: "#8ED462"
  coral: "#FF6B5A"
  sun: "#FFD23F"
  pond: "#4FA6E3"
  lilac: "#EBC1FF"
  ink: "#1B1D1A"
  ink-2: "#2C2E2A"
  land-deep: "#2B4A1F"
  coral-deep: "#5A2620"
  sun-deep: "#4D4012"
  pond-deep: "#173A52"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "76px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.035em"
    fontFeature: "\"tnum\", \"ss01\""
  display-figure:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "76px"
    fontWeight: 800
    lineHeight: 0.8
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\", \"ss01\""
  headline:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "48px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\", \"ss01\""
  body-reading:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  status:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 650
    lineHeight: 1.35
rounded:
  mark: "5px"
  field: "12px"
  surface: "14px"
  sheet: "22px"
  capsule: "999px"
  area-lobe: "30px 44px 34px 52px / 40px 30px 48px 32px"
  due-lobe: "20px 26px 22px 28px / 24px 20px 26px 22px"
spacing:
  hairline-gap: "2px"
  area-gap: "8px"
  card: "14px 16px"
  gutter: "24px"
  stage: "18px 36px 30px"
  verdict-field: "26px 30px 86px"
  sheet: "26px 40px 40px 76px"
components:
  button-primary:
    backgroundColor: "{colors.land}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "6px 6px 6px 20px"
    height: "44px"
  button-primary-on-field:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text}"
    rounded: "{rounded.capsule}"
    padding: "6px 6px 6px 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.capsule}"
    padding: "6px 18px 6px 12px"
    height: "40px"
  status-capsule-supports:
    backgroundColor: "{colors.land}"
    textColor: "{colors.ink}"
    typography: "{typography.status}"
    rounded: "{rounded.capsule}"
    padding: "3px 11px 3px 9px"
  status-capsule-blocks:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    typography: "{typography.status}"
    rounded: "{rounded.capsule}"
    padding: "3px 11px 3px 9px"
  status-capsule-missing:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    typography: "{typography.status}"
    rounded: "{rounded.capsule}"
    padding: "3px 11px 3px 9px"
  status-capsule-quiet:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.text-2}"
    typography: "{typography.status}"
    rounded: "{rounded.capsule}"
    padding: "3px 11px 3px 9px"
  void-capsule:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "1px 8px"
  filter-capsule:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.capsule}"
    padding: "8px 32px"
  filter-capsule-active:
    backgroundColor: "{colors.land}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "8px 32px"
  tab-track:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.capsule}"
    padding: "4px"
  tab-selected:
    backgroundColor: "{colors.text}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "8px 16px"
  nav-item:
    textColor: "{colors.text-2}"
    rounded: "{rounded.capsule}"
    padding: "9px 12px"
  nav-item-current:
    backgroundColor: "{colors.text}"
    textColor: "{colors.ink}"
    rounded: "{rounded.capsule}"
    padding: "9px 12px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "11px 14px"
  rule-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "{spacing.card}"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-reading}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.sheet}"
  verdict-field-appeal:
    backgroundColor: "{colors.land}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.verdict-field}"
  worklist-area:
    backgroundColor: "{colors.land}"
    textColor: "{colors.ink}"
    rounded: "{rounded.area-lobe}"
    padding: "16px 20px"
    height: "112px"
  due-lobe:
    backgroundColor: "{colors.land}"
    textColor: "{colors.ink}"
    rounded: "{rounded.due-lobe}"
    padding: "9px 13px"
---

# Design System: Denial Auditor

## Overview

**Creative North Star: "The Guide Map, at Night"**

Every denial is an area on one map, and its verdict is the colour of the land. The system is a zoo-and-gardens guide map translated to dark: the map's cream water becomes a near-black ink-green ground, cream becomes the text, and the land keeps its flat, saturated colours. A biller reads the answer from the colour of a field before reading a word, then checks the evidence rule by rule against source documents set in the same single grotesk.

Colour is flat and unmodulated. There is no glow, grain or drop shadow; surfaces separate by tone and by 1px hairlines, and the big verdict field is divided from the dark ground by a drawn coastline rather than a border. Controls are capsules, and the primary capsule carries a round chip on its trailing edge. Small things that move take 0.4s and overshoot before they settle; colour changes ease out without overshoot.

Density is a working tool's density: a 232px rail, a rules column beside tabbed source sheets, and tables at 15px. The monumental type is reserved for two things only: the verdict word and the days-left figure.

**Key Characteristics:**
- Five flat land colours, each bound to one verdict or status, on a near-black ink-green night ground.
- Two tones per land: deep land with cream text at rest, bright land with ink text when selected or when the colour is the answer.
- Colour always travels with its word (status capsules), never alone.
- One grotesk (Hanken Grotesk, variable 100 to 900), tabular figures everywhere.
- Coastlines and organic lobes divide; rectangles with borders do not.
- Capsule controls with a round chip; 0.4s overshoot on small transforms only.

## Colors

A night map: dark tonal ground, cream text, and five flat land colours that each mean exactly one thing.

### Primary
- **Land Green** (land): Appeal, and Supports for a rule. The default primary capsule, the brand lobe, input focus, the caret, timeline bars, completed pipeline steps.
- **Coral** (coral): Don't appeal yet, and Blocks for a rule. Also the tamper colour: VOID capsules, strike-through on quotes not found in a source, error text, red-flag timeline marks.
- **Sun** (sun): Ask the physician, and Missing docs. Also the selection colour, the skip link, the synthetic-data dot and the in-progress pipeline pulse.
- **Pond** (pond): Fix and resubmit, and verified policy quotes. Also the focus ring.
- **Lilac** (lilac): Not winnable, and the confidence capsule.

### Secondary
- **Deep Land, Deep Coral, Deep Sun, Deep Pond** (land-deep, coral-deep, sun-deep, pond-deep): the same areas at rest. Evidence highlights in policy and chart sheets sit on these with cream text, so a page of findings stays calm and legible on the night ground.

### Neutral
- **Night Ground** (ground): page, rail, input wells, and the water the coastline cuts out of the verdict field.
- **Night Surface** (surface) and **Raised Night** (surface-2): sheets, cards, the board, the tab track; surface-2 is the hover and active row tone.
- **Stone** (stone): Not applicable, quiet fills, and the area colour for any unmapped verdict.
- **Hairline** (line) and **Strong Hairline** (line-2): 1px dividers and inset outlines; line-2 for input and ghost-button outlines and scrollbar thumbs.
- **Cream** (text), **Cream 2** (text-2), **Cream 3** (text-3): primary, secondary and tertiary text. Cream 3 holds at least 5.4:1 on every night surface. Cream is also the selected fill for tabs and the current nav item.
- **Ink** (ink) and **Ink 2** (ink-2): text on any bright land colour; ink-2 for secondary lines on a field (at least 4.9:1 on coral, the lowest land).

### Named Rules
**The One Meaning Rule.** Each land colour means one verdict and its matching rule status; never use a land colour as decoration or as a generic accent.

**The Colour-Plus-Word Rule.** A status colour always appears with its word (Supports, Blocks, Missing docs, Not applicable, Appeal, Don't appeal yet, Ask the physician, Fix & resubmit, Not winnable, VOID). Colour alone never carries a status.

**The Ink-on-Land Rule.** Text on a bright land colour is ink; text on deep land or night is cream. Never put cream on bright land or ink on night.

## Typography

**Display Font:** Hanken Grotesk (with system-ui, -apple-system, Segoe UI, sans-serif), self-hosted variable woff2, OFL.
**Body Font:** Hanken Grotesk, the same family.

**Character:** One friendly grotesk does everything, from the 76px verdict to the 11px sentence numbers; hierarchy comes from weight (400 to 800, including 650 and 750) and tight negative tracking at display sizes. Tabular figures and stylistic set 1 are on globally, so counts and dates align.

### Hierarchy
- **Display** (800, 76px, 0.92): the verdict word on the verdict field. 50px below 760px.
- **Display figure** (800, 76px, 0.8, -0.04em): days left on the verdict field; underlined 5px when the deadline is soon. Worklist areas use the same voice at 48px, due lobes at 28px.
- **Headline** (800, 48px, 0.95, -0.04em): page titles. 34px below 760px.
- **Title** (750, 22px, 1.15): sheet heads and How-it-works section heads; 17px for the citation gate head.
- **Body** (400, 15px, 1.5): interface text and tables. Ledes at 16px in cream 2, capped at 62ch.
- **Body reading** (400, 16px, 1.7): source sheets, capped at 72ch per paragraph; the appeal editor at 15.5px / 1.65.
- **Label** (600, 13px): field labels and column heads in sentence case, in cream 2 or cream 3. Never uppercase, never letter-spaced.
- **Status** (650, 12.5px): status capsules, filter counts, area captions (14.5px).

### Named Rules
**The Two Monuments Rule.** Only the verdict word and the days-left figure are set at display size; everything else stays at working size.

**The Sentence Case Rule.** Labels and headings are sentence case at normal tracking. The only all-caps word in the system is the VOID capsule.

## Layout

A two-column shell: a sticky 232px rail and a fluid stage (padding 18px 36px 30px). The case view stacks the verdict field across the stage, the decision strip, then a workspace of a rules column (330 to 400px) beside the tabbed source sheet, 24px apart. The appeal view pairs the editor with a 360px sticky citation gate; the live view pairs a 280 to 420px form panel with progress.

Spacing is a working rhythm rather than a strict scale: 2px between nav items and tabs, 8px between worklist areas and rule cards, 14px by 16px inside cards, 24px gutters, 26px by 30px inside the verdict field with 86px at the bottom for the coastline.

**Breakpoints.**
- **At 1100px and below**, the workspace and appeal grids collapse to one column and the citation gate stops being sticky.
- **At 760px and below**, the rail becomes a sticky top bar with icon-only nav (labels kept for screen readers), the stage padding drops to 14px, page titles go to 34px, the verdict field becomes one column (padding 20px 18px 66px, coast 52px tall) with the verdict and days figure at 50px, worklist areas pair two per row (92px tall, 38px counts), the decision strip becomes a 2 by 2 grid, and the board hides the reason column and stacks the verdict capsule under the patient.

## Elevation & Depth

The system is flat. There are no drop shadows. Depth comes from tone (ground, surface, surface-2) and from inset hairlines drawn with `box-shadow: inset 0 0 0 1px` in place of borders, so outlines never change a box's size. Rings appear only as state: a 2px cream ring on the selected rule card, a 2px ring in a highlight's own bright colour when its rule is hovered, a 2px pond ring on a focused board row, and a 3px surface halo that lifts timeline dots off the axis.

### Shadow Vocabulary
- **Hairline outline** (`box-shadow: inset 0 0 0 1px var(--line)`): cards, sheets, board, tab track, decision strip, filter capsules at rest.
- **Strong outline** (`box-shadow: inset 0 0 0 1.5px var(--line-2)`): ghost capsules; inputs use 1px line-2 and 2px land when focused.
- **Selected ring** (`box-shadow: inset 0 0 0 2px var(--text)`): the selected rule card.

### Named Rules
**The Flat Land Rule.** Colour fills are flat: no gradients, glow, grain or drop shadow. Layered backgrounds exist only to drive the highlight sweep, and each layer is a single flat colour.

## Shapes

Three families. Capsules (999px) for every control and status: buttons, filters, tabs, nav items, status marks, chips, the fold control. Gently rounded rectangles for containers: 14px for rule and fact cards, 22px for sheets, the board, the gate, panels, and the top of the verdict field; 12px for inputs; 5px for inline highlights. Organic lobes for things that are land: worklist areas and due figures use asymmetric elliptical radii (each of the five areas has its own), and the brand mark is a hand-drawn lobe with an ink check.

The verdict field has no bottom corners; its lower edge is a coastline, one SVG path in the ground colour biting up into the field (72px tall, 52px on small screens).

## Components

### Buttons
Capsules that carry a round chip on the trailing edge.
- **Shape:** full capsule (999px), at least 44px tall.
- **Primary:** land fill, ink label at 650, padding 6px 6px 6px 20px, then a 32px round ink chip holding the button's own inline SVG icon (download, copy, play) in cream, or a cream arrow when the button has none.
- **On the verdict field:** the colours invert, with an ink capsule, cream label and cream chip with an ink icon, so the primary reads against any land.
- **Hover / Active:** the chip slides 3px toward the trailing edge (0.4s overshoot); press scales the capsule to 0.97. Disabled drops to 38% opacity with a not-allowed cursor.
- **Ghost:** transparent with a 1.5px line-2 inset outline, 40px tall, an 18px leading icon with no chip; the outline brightens to cream 2 on hover and a back icon nudges 2px left. On the verdict field the outline and label become ink.

### Status capsules
- **Style:** flat land fill, ink word at 12.5px / 650, padding 3px 11px 3px 9px, led by a 6px dot in the text colour at 75% opacity.
- **Vocabulary:** Supports (land), Blocks (coral), Missing docs (sun), Not applicable and Route not used (stone with cream 2); verdict capsules Appeal (land), Don't appeal yet (coral), Ask the physician (sun), Fix & resubmit (pond), Not winnable (lilac).
- **VOID:** a coral capsule (11px, 800, 0.04em tracking) set before any quote the citation gate could not find in a fetched source. The quote is struck through in 2px coral, the closest real source text is shown beside it as a pond highlight, and the Export letter capsule is disabled until every quote verifies.

### Chips (filters)
- **Style:** night-surface capsules with a 1px hairline, cream 2 label at 600, padding 8px 32px, and a 9px round chip in the filter's colour riding the trailing edge.
- **State:** when a filter is live the capsule fills with its colour, the label turns ink, and the chip crosses to the leading edge and turns ink (0.4s overshoot). Mode toggles drop the chip and fill cream when pressed. Small evidence chips in the decision strip (11.5px / 650, land, coral or sun) lift 2px and scale to 1.04 on hover.

### Cards / Containers
- **Corner Style:** 14px for rule and fact cards, 22px for sheets, board, gate, panels and strips.
- **Background:** night surface; surface-2 on hover.
- **Shadow Strategy:** hairline insets only (see Elevation & Depth).
- **Internal Padding:** 14px by 16px for cards; sheets 26px 40px 40px 76px, with sentence numbers hung in the left margin.
- **Rule card:** a status capsule and the rule's address on one line, a one-line summary at 600, then the first quote clamped to two lines behind a 1px line-2 rule. Selecting it adds the 2px cream ring and unclamps the quote.

### Inputs / Fields
- **Style:** ground well, 1px line-2 inset outline, 12px radius, padding 11px 14px; labels above at 13px / 600 in cream 2.
- **Focus:** the outline becomes 2px land. The appeal editor uses the same treatment at 22px radius.

### Navigation
- **Rail:** 232px, ground colour with a 1px hairline on its right, brand lobe and two-line name at 800 above capsule nav items (19px stroked inline SVG icons, 500 cream 2). Hover fills night surface; the current page fills cream with ink text at 600.
- **Tabs:** a capsule track (night surface, 4px padding, hairline) of capsule buttons in cream 3; the selected tab fills cream with ink text (0.25s ease-out).
- **Mobile:** at 760px the rail becomes a top bar of icon-only capsules.

### Evidence highlights
Two-tone flat fills on source text. At rest a found span sits on its deep land with cream text (deep land for Supports, deep coral for Blocks, deep sun for Missing docs, deep pond for a verified quote, stone for Not applicable). When its rule is selected, the bright land sweeps across from left to right (0.4s ease-out) and the text turns ink partway through; Not applicable sweeps to line-2 and keeps cream text. Highlights clone their padding across line breaks.

### The verdict field (signature)
A flat field of the verdict's land colour across the top of the case view, in ink: patient and payer on one line, the verdict word and the days-left figure as the two monuments, the reason in ink 2 (max 66ch), and the primary capsule at the right. Its lower edge is a coastline: one cubic path through five points whose heights are seeded by a hash of the case id and the open tab, so every case and tab has its own coast. Opening a case starts from the previous case's colour and coast, then morphs the path (0.4s overshoot) and recolours the field (0.4s ease-out) to the new one; switching tabs redraws the coast.

### Worklist areas
One flat lobe per verdict above the board, with the count at 48px / 800 and the verdict word below in ink. Each area's width grows with its count (flex-grow equals the count, minimum 150px). The areas are filters: pressing one keeps its land while the others recede to night surface with their count still in the verdict's colour. Hover lifts 3px with overshoot.

### Due lobes
In the board's first column, days left as a 28px / 800 figure on a small lobe in the verdict's colour with the due date beneath in ink 2. A soon deadline is underlined 3px.

### Decision strip
"How it was decided": one night-surface strip (22px radius, hairline) split into four equal stages by 1px vertical hairlines, each with a 13.5px / 700 head, a status capsule and a cream 3 note. On small screens it becomes 2 by 2, with hairlines between rows.

## Do's and Don'ts

### Do:
- **Do** bind every land colour to its verdict and status (land Appeal and Supports, coral Don't appeal yet and Blocks, sun Ask the physician and Missing docs, pond Fix & resubmit and verified quotes, lilac Not winnable).
- **Do** pair every status colour with its word in a capsule.
- **Do** keep findings on deep land with cream text and reserve the bright land with ink text for the selected rule and for fields where the colour is the answer.
- **Do** divide the verdict field from the ground with a coastline, and divide strips and tables with 1px hairlines.
- **Do** make controls capsules; give the primary a round chip on its trailing edge.
- **Do** use the 0.4s overshoot (cubic-bezier(.34, 1.56, .64, 1)) only for small transforms and the coast morph, and ease-out (cubic-bezier(.16, 1, .3, 1)) for colour changes and the highlight sweep.
- **Do** honour reduced motion: every animation and transition is switched off, the highlight lands in its final state, and scrolling to a rule jumps instead of smooth-scrolling.
- **Do** lock export and mark VOID in coral whenever a quote does not match fetched text.

### Don't:
- **Don't** use gradients, glow, grain or drop shadows on fills.
- **Don't** put cream text on bright land, or ink text on night.
- **Don't** let colour carry a status without its word.
- **Don't** add a second typeface; the hierarchy is weight and size within Hanken Grotesk.
- **Don't** set anything but the verdict word and days figure at display size.
- **Don't** use uppercase letter-spaced labels; VOID is the only all-caps word.
- **Don't** overshoot colour, layout or large surfaces; overshoot is for chips, lifts, presses and the coast.
