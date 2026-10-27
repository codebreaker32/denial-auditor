---
name: Denial Auditor
description: Light, airy, premium SaaS on a flat grey ground. One white sheet, cards one tone step apart, Switzer set large and light, black pill buttons. Colour lives on status only, and blue means only "verified against fetched text".
colors:
  frame: "#EDEDEC"
  sheet: "#FFFFFF"
  card: "#F5F5F4"
  raised-2: "#EDEDEC"
  hover: "#E8E8E6"
  rule: "#ECECEA"
  border: "#E4E4E2"
  control: "#D6D6D3"
  text: "#121212"
  muted: "#4D4D4D"
  faint: "#666666"
  on-dark: "#FFFFFF"
  primary: "#121212"
  primary-ink: "#FFFFFF"
  primary-hover: "#000000"
  primary-press: "#333333"
  accent: "#1E4BD7"
  accent-ink: "#1A40B8"
  accent-tint: "#EBF0FD"
  accent-wash: "#F4F7FE"
  accent-line: "#8EA5EC"
  positive: "#12865A"
  positive-ink: "#0E6E4A"
  positive-tint: "#E3F4EC"
  positive-hl: "#CFEEDF"
  warning: "#E0A008"
  warning-ink: "#8A5F00"
  warning-tint: "#FFF4D6"
  warning-hl: "#FFE7A3"
  negative: "#D93636"
  negative-ink: "#B42828"
  negative-tint: "#FDECEC"
  negative-hl: "#FAD6D6"
  highlight: "#F9B91C"
typography:
  verdict:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: "34px"
    letterSpacing: "-0.03em"
  figure:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: "40px"
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  title:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "34px"
    letterSpacing: "-0.03em"
  phone-title:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: "30px"
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: "26px"
    letterSpacing: "-0.015em"
  section:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.01em"
  reading:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "26px"
  body:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.006em"
    fontFeature: "tnum"
  label:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  meta:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  field-label:
    fontFamily: "Switzer, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  sheet: "28px"
  sheet-phone: "22px"
  card: "20px"
  tile: "16px"
  small: "6px"
  highlight: "4px"
  pill: "999px"
spacing:
  base: "4px"
  inset: "8px"
  card-pad: "20px"
  gap: "24px"
  pad: "32px"
  pad-phone: "16px"
  pill-h: "24px"
  control-h: "36px"
  field-h: "40px"
  row-h: "64px"
  sidebar: "232px"
  ledger: "372px"
  gate: "320px"
  gutter-sentence: "112px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
    height: "{spacing.control-h}"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-ink}"
  button-primary-active:
    backgroundColor: "{colors.primary-press}"
    textColor: "{colors.primary-ink}"
  button-secondary:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
    height: "{spacing.control-h}"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
  button-disabled:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.faint}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "{spacing.field-h}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  mark-positive:
    backgroundColor: "{colors.positive-tint}"
    textColor: "{colors.positive-ink}"
    rounded: "{rounded.pill}"
    height: "{spacing.pill-h}"
  mark-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.pill}"
    height: "{spacing.pill-h}"
  mark-negative:
    backgroundColor: "{colors.negative-tint}"
    textColor: "{colors.negative-ink}"
    rounded: "{rounded.pill}"
    height: "{spacing.pill-h}"
  mark-neutral:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "{spacing.pill-h}"
  mark-verified:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    height: "{spacing.pill-h}"
  citation-gate:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  not-in-source-mark:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.negative-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px 0 8px"
    height: "24px"
  nav-item-current:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 12px"
---

# Design System: Denial Auditor

## Overview

**Creative North Star: "One white sheet on a quiet desk"**

The product is a light, airy, premium SaaS tool. The user chose it on 2026-10-26, with Halo Lab's "Bubdle" as the reference, after rejecting the photocopy, guide-map, blue-pencil, red-claim-form and colour-chapter worlds. The anti-slop rules of taste-skill v2 take priority over the reference. A flat grey ground (#EDEDEC) holds the sidebar and the context line. All the work sits on one white sheet with 28px corners, and every group on that sheet is a soft grey card, one tone step away. Nothing is outlined, nothing casts a resting shadow and nothing uses a gradient. Type is Switzer, set large and light: titles at 400 weight with tight tracking, the verdict at 28px (ink, with only its glyph in the status hue), the days-left figure at 36px, and body text at 14px.

The density suits a biller working a queue: 64px worklist rows, a 372px rules ledger beside the policy text, and a 320px citation gate beside the appeal letter. Colour is kept for meaning. Green, amber and red mark evidence and verdict status, and always come with a glyph and a word. Blue (#1E4BD7) means only "verified against text fetched for this case" (and the focus ring). Everything else is ink on grey and white.

The signature is the verified disc: a filled blue circle with a white check. It marks each quote in the letter and each line in the citation gate. As the gate confirms, the checks draw in from top to bottom, which is the one authored motion in the product. A tampered quote is struck through in red and marked "Not in source" (cross glyph, negative tone), and the source's real words appear beneath it.

**Key Characteristics:**
- Flat grey frame (#EDEDEC) around one white sheet (28px corners). From tablet up the sheet is as tall as its page, so a short list ends with its own content on the grey ground rather than holding an empty band; on a phone the sheet runs edge to edge with 22px top corners down to the bottom bar.
- Cards are #F5F5F4 on the white sheet, separated by tone alone, with no outline and no shadow.
- Pill controls: black primary buttons, grey secondary buttons, pill inputs, pill filters and pill status marks.
- Switzer only (self-hosted, weights 400, 500 and 600), on a six-step scale: 12, 14, 16, 18, 28 and 36px.
- Status = hue + glyph + word. Blue = verified, and nothing else.

## Colors

A neutral grey-and-white ground, black ink, one blue that means "verified", and three status hues kept for evidence.

### Primary
- **Verified Blue** (accent #1E4BD7, accent-ink #1A40B8): the verified disc, the "n of n match their source" mark, and the focus ring. Nowhere else: not on chrome (the brand-mark tick is ink) and not on quote rules.
- **Verified Tint / Wash / Line** (accent-tint #EBF0FD, accent-wash #F4F7FE, accent-line #8EA5EC): the verified mark's ground, the passing citation gate's ground, and the thin underline under an inline verified quote.

### Secondary (status)
- **Evidence Green** (positive #12865A / ink #0E6E4A / tint #E3F4EC / hl #CFEEDF): "Supports", "Appeal" and the passing coverage steps. Status hues sit on glyphs, words, pills and thin rules only; they never tint a card or the summary card.
- **Docket Amber** (warning #E0A008 / ink #8A5F00 / tint #FFF4D6 / hl #FFE7A3): "Missing docs", "Ask the physician" and "due soon".
- **Block Red** (negative #D93636 / ink #B42828 / tint #FDECEC / hl #FAD6D6): "Blocks", a waiting period counted short ("short by 4 days"), overdue figures, and the "Not in source" mark on a failing quote. A blocking sentence in Next step sits behind a 1px neutral rule; its heading says "doesn't meet yet". At most one red mark per object.

### Tertiary
- **Highlight Yellow** (#F9B91C): the deck's single highlight card (Persuade only). The app does not use it.

### Neutral
- **Frame Grey** (frame #EDEDEC): the ground behind the sidebar, the context line and the sheet.
- **Sheet White** (sheet #FFFFFF): the working sheet, the current nav pill and the selected filter.
- **Card Grey** (card #F5F5F4): every grouped surface on the sheet, including the summary card, coverage path, rules, tables, panels and the timeline.
- **Raised 2 / Hover** (raised-2 #EDEDEC, hover #E8E8E6): secondary buttons, counters, skeletons and hover grounds.
- **Rule / Border / Control** (rule #ECECEA, border #E4E4E2, control #D6D6D3): hairlines between rows inside a card, input borders and the used part of the runway.
- **Ink / Muted / Faint** (text #121212, muted #4D4D4D, faint #666666): primary text, secondary text, and tertiary meta. Faint still holds 5.7:1 on white.

### Named Rules
**The One Blue Rule.** Blue means "this matches text fetched for this case", and it doubles as the focus ring. It never decorates, links or brands.

**The Hue, Glyph, Word Rule.** No status appears by colour alone. Each one pairs its hue with a stroke glyph (check, half, pause, return, slash, cross, dash, tick, fork, alert) and a word. The half-disc means only a charting gap ("Missing docs", "Met once charted", "Qualifies if charted", "Ask the physician"); a split vote has its own fork glyph; a changed policy has the alert glyph. A held denial ("Don't appeal yet", or "Reorder, don't appeal" when the service date came before the policy's waits ended) is amber with the pause glyph, never red. A "Counted in code" line takes its glyph and closing word from the comparison: a check and "meets the wait", or a cross and "short by N days".

## Typography

**Display Font:** Switzer (Fontshare, Indian Type Foundry, ITF Free Font License; self-hosted at `web/fonts/switzer-400.woff2`, `switzer-500.woff2` and `switzer-600.woff2`), with system-ui as the fallback.
**Body Font:** Switzer
**Label/Mono Font:** Switzer with tabular numerals. There is no second face and no mono face.

**Character:** One neutral grotesk, set large and light at the top and plain below. The user chose it from a specimen on 2026-10-26.

### Hierarchy
- **Verdict** (500, 28px/34px, -0.03em, ink): the recommendation word ("Appeal") in the case summary card; only its 22px glyph takes the status hue. On a phone it is 24px/30px.
- **Figure** (500, 36px/40px, -0.03em, tabular): the days-left figure or qualifying date in the summary card. On a phone it is 28px/34px.
- **Title** (400, 28px/34px, -0.03em): list-page titles ("Denials to work") and the patient name in the case breadcrumb. On a phone it is 24px/30px.
- **Headline** (500, 18px/26px): document sheet heads, read-page section heads, and the worklist's days-left figure.
- **Section** (600, 16px/24px): ledger, coverage, gate, panel and timeline heads.
- **Reading** (400, 16px/26px): policy sentences (68ch beside the 112px address gutter, which holds the sentence id, the split-vote glyph beside it when the votes split, then the status glyph and word under the id; a word too long for the rail wraps inside it as a hanging label and never crosses into the sentence column), chart notes, and the appeal letter (72ch). The 16px/24px variant carries the one-sentence why-line and the list-page finding.
- **Body / Label** (400 or 500, 14px/20px, tabular numerals): default UI text, buttons, tabs, evidence quotes, key-value rows, gate quotes and the payer's reason.
- **Meta / Field label** (400 or 500, 12px/16px): sublines, provenance, captions, column heads, sentence addresses, legal text and status marks.

### Named Rules
**The Six Sizes Rule.** Use only 12, 14, 16, 18, 28 and 36px, plus 24px for phone titles and the phone verdict. Two sizes 1px apart look like a mistake, not a hierarchy. Weight (400/500/600) and ink (text/muted/faint) carry the steps between them.

## Layout

At 1440px the layout is a 232px frame sidebar, a white sheet with an 8px inset on the right and bottom, and 32px of sheet padding. The case workspace puts a 372px rules ledger beside the policy sheet, with a 24px gap. On the appeal tab the letter sits beside a 320px citation gate that opens at the top of the letter at its full height: its head (title, count, Export, "A person reviews and sends this letter") comes first, and every quote follows in page flow. There is no nested scroller and no fade. If the head is wrapped in `.gate-top`, it stays pinned while the list scrolls under it. The spacing base is 4px, with a 24px standard gap and 20px card padding.

The case view reads top to bottom. First comes the breadcrumb with the patient name. Next is one summary card with three columns (Recommendation, Appeal window with its runway, Next step) on plain card grey: the verdict never tints the card. Worklist rows and the breadcrumb carry no initials avatars; the patient name owns the identity column. In each rule card the chart quote takes the full card width (four lines) with its source note on its own line beneath it. Then the why-line, the payer's reason and the policy in force, then the coverage path as one card of four cells split by hairlines. Last come the ledger and the tabbed documents. Tab panels sit directly on the sheet. The summary card always holds exactly one primary button: the one that opens Next step, then, once it is open, the next thing to do there (Export letter, Copy note to physician, Copy checklist, Open the prior-auth check). A held denial a dated note could win has "Note to physician" as its Next step: the note itself, read-only, on the letter tray, each quoted policy line run through the citation gate and marked Verified, above the primary Copy button. The appeal letter and the denial scan are white paper on a card-grey tray (8px of #F5F5F4 around the page, 6px on a phone), so they read as paper without an outline. Worklist rows keep one 64px pitch on desktop: each row is a grid on the table's column split, and the payer's reason is clamped to two lines (full text in the cell's title). At 641–1100px the reason leaves the table and runs under the patient with the service date, two lines at most.

The worklist is a fixed-layout table inside one card, with 64px rows. Each row's next step is an inline link whose chevron follows its last word.

The prior-auth list ends with a legend of the readiness labels it uses. On desktop the labels sit in one even row (one column per label shown, the pill above its definition); from 1100px down each label takes a row with the pill in a 190px column beside its definition, and on a phone the pill sits above it. The footnote under the legend is its own paragraph, 24px below. The list's planned date is the row's sort key and reads at 14px ink.

Responsive behaviour:
- **≤1100px:** the sidebar becomes a 56px top bar, and the workspace, appeal, live and how-it-works views drop to one column. The gate stops being sticky, and a compact gate bar with the count and Export sits above the letter.
- **≤860px:** the summary card stacks, and the coverage path goes two by two.
- **641–1100px:** worklist filters wrap into separate pills (the selected one black), so no label is clipped, and the count sits on its own line.
- **≤640px:** this is the phone layout. Case and prior-auth pages show one region at a time: a sticky segmented switch under the why-line (Rules, then Policy, Chart, Notice, and the Next-step document) shows either the case details, coverage path and rule cards, or one document. History folds under its heading. In the appeal letter long verified quotes fold to three lines with a "Whole quote" button, and the summary card holds the phone's one Export. The sheet runs edge to edge with 22px top corners, and navigation moves to a fixed bottom bar. Filters become one scrolling strip of pills inside the margin, fading at its right edge. The "Model calls and cost" disclosure keeps its label on one line, with the runtime detail on the line below. Table rows become two-column stacks, and actions go full width at 44px.

## Elevation & Depth

The system is flat, with no shadows anywhere. Depth comes from tone alone: frame grey, then sheet white, then card grey, then hover grey. Selection is shown by a step to white with a 1.5px ink outline (the selected rule), never by a lift.

### Named Rules
**The Tone Step Rule.** Separate surfaces by one tone step, never by an outline, a shadow, a blur or a gradient. Hairlines exist only between rows inside a card.

## Shapes

Shapes are soft and generous. The sheet has 28px corners (22px top corners on a phone). Cards have 20px corners (16px on a phone), and smaller inset tiles (the failing-quote tile, phone nav targets) use 16px. Every control is a pill (999px): buttons, inputs, filters, status marks and nav items. Text highlights use 4px corners, focus outlines and skeletons use 6px, and runway ticks are 1–2px hairlines.

## Components

### Buttons
Black pills, with one primary per screen.
- **Shape:** pill (999px), 36px minimum height, padding 9px 18px. In the summary card's Next step column they grow to 44px with 16px text.
- **Primary:** ink ground (#121212) with white 500 14px/20px text and an optional 16px stroke icon. Hover goes to #000000 and press to #333333.
- **Secondary:** raised-2 grey ground with ink text. Hover goes to #E8E8E6.
- **Text:** muted text with no ground. Hover turns it to ink.
- **Disabled / locked export:** raised-2 ground, faint text and a not-allowed cursor. The locked state always shows a sentence saying what to fix.
- **Focus:** a 2px blue outline with a 2px offset on every control.

### Status marks
- **Style:** 24px pills with 500 12px text and a 13px glyph before the word. Positive, warning and negative use their ink on their tint. Neutral uses raised-2. Quiet uses a transparent ground with a 1px control edge. Verified uses accent-ink on accent-tint, with the verified disc.

### Cards / Containers
- **Corner Style:** 20px (16px on a phone).
- **Background:** card grey (#F5F5F4) on the white sheet. The summary card stays card grey whatever the verdict; only the passing citation gate takes accent-wash (blue means verified).
- **Shadow Strategy:** none (see Elevation).
- **Border:** none. Only rows inside a card are split by 1px rule hairlines.
- **Internal Padding:** 20px. The summary card uses 18px 24px 22px, and rules use 16px.

### Inputs / Fields
- **Style:** 40px pill, 1px control border, sheet-white ground. Labels above are 12px 500 faint field labels in sentence case.
- **Focus:** a 2px blue outline, and the border turns blue.

### Navigation
- **Style:** frame sidebar links, 36px pills, muted 500 14px text with 16px stroke icons and counters on the right.
- **Hover:** hover-grey ground with ink text.
- **Current:** a sheet-white pill, so the current item reads as part of the sheet.
- **Mobile:** a fixed white bottom bar with a stacked icon and a 12px label. Targets are 52px with 16px corners.

### Appeal letter and citation gate (signature)
The letter is set at 16px/26px with a 72ch measure on a white page seated on a card-grey tray (no border, no shadow). Verified block quotes are set in 16px from a 1px neutral rule; the blue stays on the Verified disc. Each one carries a single right-aligned 12px attribution: the verified disc, "Verified" and the source id. An inline verified quote gets a thin blue underline and a raised 12px reference (the disc and the source id), which is kept on the line of its closing quote mark. The gate on the right is the full proof, at full height in page flow (no inner scroll, no fade). It shows the count mark, Export (locked until every quote verifies), the sentence "A person reviews and sends this letter", and every quote, clamped to three lines and opening fully on hover or focus, with its source. The checks draw in one after another (320ms each, on the system ease, staggered 45ms). Reduced motion turns this off.

### Failing quote
A tampered quote is struck through with a 1.5px red line on a negative-tint tile with 16px corners. Across its top-left sits a status mark on white: the cross glyph and "Not in source" in negative ink. Inline quotes and gate rows use the same mark. The source's real words follow, under "Source says". The gate counts quotes in both states: passing reads "12 quotes, 22 uses, all match"; failing reads "Export blocked: 1 quote not in source" and "1 of 12 quotes doesn't match the text fetched for this case".

### Demo calendar
The review date is named once, in the sidebar: "Review date 09/01/2026 (demo calendar)", with one History row that explains it. Nothing else narrates which calendar a date belongs to. A CMS policy row reads "Policy on {date}"; an Aetna page reads "Policy (snapshot)" with its fetch and effective dates, and the watch says "Checked 10/25/2026, text unchanged".

### Deck and video (Persuade)
They use the same ground, white cards, Switzer and black pills at poster scale, with 32px card corners on a 1280×720 slide. Yellow #F9B91C is the one highlight card. 3D objects (the MRI scanner and the fax notice) sit in glass bubbles rendered to `deck/src/assets/*-bubble.png`.

## Do's and Don'ts

### Do:
- **Do** separate every surface by one tone step: frame #EDEDEC, then sheet #FFFFFF, then card #F5F5F4.
- **Do** make every control a pill (999px). Use one black primary per screen.
- **Do** set all text in Switzer on the six-step scale (12/14/16/18/28/36, with 24 on a phone).
- **Do** pair every status with its hue, its glyph and its word.
- **Do** keep blue for "verified against fetched text" and for focus.
- **Do** keep motion to feedback (150ms on cubic-bezier(.16, 1, .3, 1)), apart from the gate's check sequence.

### Don't:
- **Don't** add outlines around cards, resting shadows, glass or gradients to the app.
- **Don't** use violet anywhere (user rule).
- **Don't** introduce a second typeface, a mono face, or sizes between the steps (13, 15, 17, 32).
- **Don't** use blue for links, branding or decoration.
- **Don't** return to a themed world: photocopy, guide map, blue pencil, red claim form or colour chapters.
- **Don't** put a category label or kicker above a heading.
