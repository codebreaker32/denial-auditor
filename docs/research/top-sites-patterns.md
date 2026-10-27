# Top-site patterns for the Denial Auditor redesign

Reference study, 2026-10-27. The input is `docs/research/ui-ux-requirements.md`, and this document is written for the engineer building `ui/` (React 19, Tailwind 4, shadcn, with `motion`, `gsap`, `lenis`, `three`, `@number-flow/react` and `sonner` already installed).

**Method.** I loaded each site in headless Chromium (Playwright, 1440×900) and read computed styles: fonts, sizes, tracking, every element's `transition-*`/`animation-*`, `document.getAnimations()`, the primary button before, on hover and on mouse-down, and colour frequency over the first 2,500 elements. I took screenshots at t=5 s and t=6.5 s and after two scrolls. They are saved in `.impeccable/critique/refs/`, including the globe frames `wemakedevs-globe-0..3.png` and `stripe-globe-0/1.png`. The engineering write-ups for the Stripe and GitHub globes were read for build details.

Sources: https://stripe.com · https://vercel.com · https://www.wemakedevs.org · https://linear.app · https://www.raycast.com · https://resend.com · https://stripe.com/blog/globe · https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/

Limits: headless Chromium drew no WebGL for the Raycast hero. The Vercel hero triangle canvas was still at `opacity:0` when measured, so it fades in late. `:active` states read through Playwright can miss JS-driven press effects.

---

## 1. Site by site

### WeMakeDevs (the user's favourite)
- **Hero composition:** a dark ground (near-black `lab(2.6 …)`, about #070809) with a hairline grid frame. Visible vertical rails sit at the container edges, sections are separated by 1px lines, and the nav is also ruled. Text takes the left 60%. The globe (550px WebGL2 canvas) sits top-right and bleeds past the nav line. Under the buttons there is a 3-cell stat strip in mono.
- **The globe:** dotted continents (sampled land points; the bundle uses a `mapSamples: 6000` dotted-map generator with `stagger` and `pulse` options), a dark sphere with a faint rim glow, orange markers where builders come from, and pulsing orange rings on host cities. City labels are small mono chips ("San Francisco", "New York"). A two-line mono legend top-right explains the markers ("Cities where we host events / Where our builders are from"). `cursor: grab` makes it draggable.
  - Speed: from the frame diff it turns about 0.05 rad/s, roughly **one revolution every ~2 minutes**. It's so slow you notice it only at the edge of attention, which is why it "just feels right".
  - Marker pulse: `ping 1s cubic-bezier(0,0,0.2,1) infinite` (Tailwind ping).
  - Staying behind content: the globe is smaller on mobile with lower opacity (`w-[220px] opacity-30 → sm:opacity-40 → md:opacity-100 lg:w-[550px]`) and a `transition-opacity duration-700` fade-in on load.
  - Relevance: the globe *is* their data (where the community lives), and the legend says so. It's a chart, not decoration.
- **Typography:** Inter 66px/700, tracking −1.65px (−0.025em), line-height 1.15. A two-colour H1 (white line plus brand-green line). Geist Mono is the second voice for the uppercase eyebrow ("BUILD COOL STUFF. SHIP REAL PROJECTS."), section indexes (`01 / IMPACT`, `03 / HACKATHONS`), stats and nav.
- **Colour:** greyscale plus two accents, each with one job. Green `lab(70.6 −66.5 45.8)` (about #1FC85A) is brand and action; orange is data on the globe only.
- **Hover/press:** background shifts only (green darkens to `lab(37 …)` over 300ms `cubic-bezier(0.4,0,0.2,1)`; dark buttons lighten over 150ms). No transform on press.
- **Motion inventory:** 150/200/300ms standard transitions; entrances `enter 0.7s` with `cubic-bezier(0.22,1,0.36,1)` (easeOutQuint) at 500–700ms; logo marquee `40s linear infinite`; five continuous globe animations at 5–10 s periods (marker pulses, de-phased).
- **Text:** 998 words on the home page. Stats are mono numerals with a two-word caption.

### Stripe
- **Hero:** white page with visible vertical rails at about x=88 and x=1352, the same rail device as WeMakeDevs. A WebGL ribbon (`single-wave__canvas`, 1393×761) bleeds off the top-right corner and holds **all** the hero colour. The headline is one paragraph in two tones: the claim is ink `#061B31`, the elaboration slate `#3C4F69`/`#64748D`, at the same size. Above it sits a live ticker, "Global GDP running on Stripe: 1.73948278%", a number with eight decimals that keeps counting. That is liveness without decoration, and a pattern to copy.
- **The globe** (now further down, under "The backbone of global commerce"): a radial burst of fine blue lines with dot terminals, glowing warm at the core, over a soft blue radial wash, with a sun/moon theme toggle. The original 2020 globe (blog) was three.js with three layers: an ocean sphere (about 50 segments), about 20,000 country dots placed on a sunflower spiral and masked by a colour-coded PNG, and arcs as tube geometry (8 sides, 44 segments along a cubic Bézier) drawing in over **2.5 s**. Arcs connect where payments come from to where they are accepted. It ran at a 60fps target; animation pauses during scroll (16ms throttle) and stops once the globe leaves view; `antialias: false` gave the largest performance gain; a static image is the fallback.
- **Typography:** Söhne variable at **weight 300**, H1 48px/55px (−0.02em), H2 56px (−0.025em), lead 32px/300. Light weights at large sizes are the "premium" signal.
- **Colour:** the chrome is ink navy plus slate greys plus one blurple `#533AFD` for actions. The gradient lives only in the hero ribbon and photo panels.
- **Easing:** the dominant transition is **300ms `cubic-bezier(0.25,1,0.5,1)`** (easeOutQuart, 494 elements). Reveals use 800ms `cubic-bezier(0.165,0.84,0.44,1)`; long settles 1s `cubic-bezier(0.16,1,0.3,1)` (expo-out); nav 240ms `cubic-bezier(0.45,0.05,0.55,0.95)`; heading colour shifts on scroll 1.2s `cubic-bezier(0.65,0,0.35,1)`.
- **Hover/press:** the primary darkens `#533AFD → #4032C8` over 300ms. No scale.
- **Cards:** no icon+title+blurb cards. Each "card" is a composited product UI (a dashboard table plus an overlapping checkout sheet) on a hatch-line gradient backdrop, cropped by the card edge.
- **Text:** 1,720 words, a long page made of short blocks.

### Vercel
- **Hero:** off-white `#FAFAFA` in three columns: a two-word H1 left ("Agentic Infrastructure"), a large black triangle centre (canvas fades in late), and three short mono-ish lines right. Logo row at the fold.
- **Typography:** Geist 64px/400, line-height 1.0, tracking **−3.84px (−0.06em)**, the tightest of the set. H2 56px/450 (−0.06em). Geist Mono for supporting lines.
- **Colour:** effectively pure greyscale (`#171717`, `#4D4D4D`, `#8F8F8F`, `#FAFAFA`) with one blue `#0072F5` used once.
- **Easing:** micro 100ms and 150ms `cubic-bezier(0.4,0,0.2,1)`; enters 200–500ms `cubic-bezier(0,0,0.2,1)`; one `cubic-bezier(0.23,1,0.32,1)`.
- **Text:** **124 words on the whole home page**, the strongest example of "say less".
- **Cards:** real product UI (a Notion AI chat panel) on a hairline-bordered plane, fading into the ground at the bottom (a mask, not a border).
- **Login:** a centred white card with a 2-line H2, four full-width provider buttons, a text link and a one-line customer proof below. A template for our mock login.

### Linear
- **Hero:** dark `#08090A`. **Staged entrance**: at t=5 s the hero was still empty; by t=6.5 s the H1, sub and a full app screenshot had arrived. The heading comes first, then the UI rises in.
- **Typography:** Inter Variable 64px at weight **510** (a variable-axis value, not 500), line-height 1.0, −0.022em. Body 15px/24px in `#8A8F98`. Berkeley Mono as the second voice.
- **Colour:** greys only (`#F7F8F8`, `#D0D6E0`, `#8A8F98`, `#62666D`). Status colours (`#EB5757`, `#4EA7FC`) appear only inside product UI, never as decoration.
- **Easing:** hover **100–160ms `cubic-bezier(0.25,0.46,0.45,0.94)`** (easeOutQuad, 233 elements); panels and drawers **700ms `cubic-bezier(0.32,0.72,0,1)`** (iOS-sheet curve); a dot grid animating with `steps(1)` over 2.8 s, a deliberately "digital" tick.
- **Hover:** the sign-up pill goes `#E5E5E6 → #FFFFFF` (brighten on dark). A 3-layer soft shadow stays constant.
- **Cards:** real app panels (Slack thread over a kanban board) that overlap and fade into the dark.

### Resend (extra 1)
- **Hero:** black, with a single diagonal light streak (WebGL, `webgl-scale-in-fade 1s`) and a **serif display** H1 (Domaine 96px/400) against an Inter body. That contrast does the premium work.
- **Section H2:** ABC Favorit 56px with −2.8px tracking (−0.05em), with **one amber phrase** (`#FFC446`): "Integrate *this afternoon*".
- **Scroll:** content reveals on enter. My scrolled capture shows an empty band where the section had not yet revealed, so the reveal is tied to the IntersectionObserver.
- **Ambient:** `rotate 30s linear`, logo `scroll-x 180s linear`; a `cubic-bezier(0.36,0.66,0.6,1)` 1.5 s breathing loop.

### Raycast (extra 2)
- **Hero:** dark, centred, H1 Inter 64px/600, a nav floating in a rounded glass bar, and a single light key-cap button with a soft shadow. The hero canvas (a red glow) didn't render headless.
- **Easing:** mostly 200–300ms `ease`; staggered `slideIn 700ms` (15 items); `blink 1.1s` cursor carets, which signal a live, typing system.

---

## 2. Cross-site patterns (evidence table)

Rule from the requirements: adopt a pattern when it is common across the top sites and confirmed in our prototype. ✓ = observed in this probe.

| Pattern | Stripe | Vercel | WMD | Linear | Resend | Raycast | Verdict |
|---|---|---|---|---|---|---|---|
| One ambient motion in the hero, bleeding off an edge, behind text | ✓ ribbon | ✓ triangle | ✓ globe | – (staged UI) | ✓ streak | ✓ glow | **Adopt** |
| Ambient motion depicts the product's own data or subject | ✓ (payments arcs) | – | ✓ (community map) | – | – | – | Adopt: this is what makes it "feel right" |
| Hero/display weight light to medium (300–510) | 300 | 400 | 700 | 510 | 400 | 600 | Adopt 300–500 |
| Tight display tracking −0.02 to −0.06em, line-height 1.0–1.15 | ✓ | ✓ | ✓ | ✓ | ✓ | – | **Adopt** |
| Mono as a second voice for labels, indexes and numbers | – | ✓ | ✓ | ✓ | ✓ | ✓ | **Adopt** |
| Greyscale chrome plus 1–2 accents with single jobs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Adopt** |
| Visible structural rails or hairline section rules | ✓ | – | ✓ | ✓ | – | – | Adopt (the anti-template device) |
| Real product UI as the illustration (no icon cards) | ✓ | ✓ | – | ✓ | ✓ | ✓ | **Adopt** |
| Hover = colour/background shift, 100–300ms, no scale | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Adopt** |
| Press = scale-down | ✗ | ✗ | ✗ | ✗ | – | – | Not on marketing sites; use only inside the app (see §4) |
| Content reveals on scroll (fade/translate, 0.7–1 s) | ✓ | light | ✓ | ✓ | ✓ | ✓ | **Adopt** |
| Live-ticking number in the hero | ✓ GDP % | – | – | – | – | – | Adopt once (distinctive) |
| Logo/proof marquee 40–180 s linear | ✓ | – | ✓ 40s | – | ✓ 180s | – | Optional (we have no logos; use for policy sources) |
| Dark hero | – | – | ✓ | ✓ | ✓ | ✓ | 4/6. See §6 for our choice |

**Measured easing families (use these, don't invent):**
- Micro (hover, colour): 100–160ms, `cubic-bezier(0.25,0.46,0.45,0.94)` (Linear) or `cubic-bezier(0.4,0,0.2,1)` (Vercel/WMD).
- Standard UI change: **300ms `cubic-bezier(0.25,1,0.5,1)`** (Stripe's most common).
- Enter/reveal: 600–800ms, `cubic-bezier(0.16,1,0.3,1)` (Stripe) or `cubic-bezier(0.22,1,0.36,1)` (WMD).
- Sheets/panels: 700ms `cubic-bezier(0.32,0.72,0,1)` (Linear).
- Ambient: periods of 5–10 s (pulses), 30–180 s (rotations/marquees), about 120 s per globe revolution.

**Text volume:** Vercel 124 words, WMD 998, Linear 1,368, Stripe 1,720, Raycast 1,746, Resend 2,159. Even the long pages keep every block to an H2 of at most 8 words plus at most 25 words of body.

---

## 3. Three candidate "globe moments" for our landing page

All three use real data from `demo/runs/` (precomputed showcase runs), so the motion is a chart of the product, as WeMakeDevs' globe is a chart of its community. None uses the MRI machine.

### A. The policy globe (recommended)
**What it depicts:** a slowly turning dotted sphere. **Each dot is one sentence of the real policy text** (Noridian LCD L34220 as fetched, plus Aetna CPB 0236 as a second, smaller sphere or hemisphere tint), placed with a Fibonacci/sunflower spiral as in Stripe's globe. The **criteria the pipeline extracted** become the "cities": dot clusters at the sentence ids `criteria.py` picked, each with a mono chip label ("6 wk conservative care", "Red-flag exclusion", "Prior imaging"). Thin arcs fly in from outside the sphere, one per piece of chart evidence (`facts.extract_facts`), and land on a criterion:
- The quote verifies (`text.locate` hit): the dot locks **blue (verified)** with a single ring pulse.
- Missing documentation: an **amber hollow ring** that keeps a slow 2.4 s pulse (the "ask physician" state).
- Excluded or not applicable: the dot dims.

A two-line mono legend top-right, as WeMakeDevs does: `● Rule met, quote verified` `○ Evidence missing: ask physician`. When a full case resolves, the verdict word types into a chip under the sphere ("Appeal"), then the next case starts. A loop holds 3 showcase cases at about 18 s each.

**Why it's relevant:** it is literally the product's core move (policy → rules → evidence → verified quote), it uses WeMakeDevs' visual grammar (dots, labelled markers, pings, legend, grab to drag), and blue keeps its one meaning, "verified".

**Build:**
- Canvas 2D with orthographic projection, not three.js. About 1,500–3,000 points is cheap in 2D, renders crisp at any DPR, has no shader toolchain and no antialias trade-off. Points are `fillRect` 1.6px, alpha by z-depth (back hemisphere at 0.15, front at 0.9), which gives the depth fade GitHub uses against moiré.
- Rotation 0.05 rad/s (about 2 min per revolution, matched to WeMakeDevs) plus a 6° fixed tilt. Drag to spin with inertia (velocity decays ×0.94 per frame) and ease back to auto-rotate after 2 s idle.
- Arcs: quadratic Bézier from a point at radius 1.35R to the target dot, drawn in with a stroke-dash reveal over **1.2 s `cubic-bezier(0.16,1,0.3,1)`**. The landing ring scales 1→2.2 and fades over 900ms (GitHub's "solid dot stays, ring expands and fades").
- Labels: absolutely positioned DOM chips (Geist Mono/IBM Plex Mono 11px). Each frame they are moved by `transform: translate3d()` from the projected point and hidden when z<0, so the text stays selectable and sharp.
- Data: a 30-line build script exports `sentences[]` (just ids and lengths; the sphere needs no text) and per showcase case the `{criterion_id, sentence_ids, evidence[], status}` from `demo/runs/*.json`. Ship it as one static JSON (<20 KB).

**Performance:**
- `IntersectionObserver` stops the rAF loop offscreen, and `visibilitychange` pauses it.
- DPR is capped at 2. If the average frame time over 50 frames exceeds 18ms, halve the point count (GitHub's tiering).
- Before the first frame, show an SVG placeholder of the same sphere (a static snapshot) and crossfade it out over 600ms (GitHub).
- `prefers-reduced-motion`: render one static frame with all three statuses visible; arcs are drawn and do not animate; drag still works.
- On mobile (<768px) it is 260px, sits behind the H1 at 35% opacity, and labels are hidden (WeMakeDevs' responsive pattern).

**Cost:** about 250 lines of TypeScript, no new dependency.

### B. The coverage map (jurisdictions)
**What it depicts:** a dotted US map (dot-sampled like WeMakeDevs' `dotted-map`) with the **Medicare MAC jurisdictions** as faint regions. Practice markers in our synthetic cases pulse in their state. Arcs run from a practice to its policy source (Noridian L34220 for the Medicare JF states; Aetna CPB 0236 as a single off-map node) and carry the version tag, e.g. `L34220 v40 · in effect on DOS`. A small mono ticker in the corner counts days since the policy-watch run (`/api/drift`).

**Why it's relevant:** it shows a real and non-obvious fact about the domain: which policy applies depends on where and when, and we cite the version in effect on the date of service.

**Build:** an SVG of about 4,000 `<circle>` elements, precomputed once (or a single `<path>` of dots for speed), with CSS-animated rings (`@keyframes ping 2.4s cubic-bezier(0,0,0.2,1)`) and arcs as SVG paths with `stroke-dashoffset`. No canvas is needed. Pan/tilt follows the cursor ±4° via `transform: perspective(1200px) rotateX/Y` on the SVG wrapper, spring-smoothed.

**Performance:** trivial, because it is mostly static SVG with a few animated paths.

**Risk:** it reads as "geography" first and "denials" second, and judges may not know what a MAC is. It is a strong secondary visual for the "Policy watch" section rather than the hero.

### C. The gate (claims flowing through the exact-quote check)
**What it depicts:** a wide horizontal field of fine streamlines (Stripe's line-burst texture) running left to right. Small particles carry quote fragments and flow toward a vertical slit made of the policy text set in 6px mono. A particle whose text matches a span in the slit passes through and turns blue. A particle that doesn't match (a one-character drift, a paraphrase) is deflected down and settles into a dim tray labelled `blocked: quote not in fetched text`. To the right, passed particles assemble into the lines of an appeal letter.

**Why it's relevant:** it shows the invariant that differentiates us, "no export unless every quote matches fetched text", which judges remember.

**Build:** Canvas 2D particle field (300–600 particles) on a precomputed flow field (curl noise baked to a 64×32 grid, sampled bilinearly). Particle speed is 40–80 px/s, and the slit is DOM text over the canvas.

**Performance:** cap at 600 particles; same offscreen/visibility pause and reduced-motion still frame as A.

**Risk:** particle fields drift toward the generic "AI flow" look. It needs restraint (monochrome lines, colour only at the gate). Best used as the scroll-pinned "Gate" section, not the hero.

**Recommendation:** use **A (policy globe)** in the hero, **C as a scroll moment** in the "gate" section (a scaled-down, scroll-scrubbed version driven by GSAP ScrollTrigger rather than a free-running loop), and **B as a small static-plus-pulse figure** in the policy-watch section. Each section then has at most one ambient motion, as the reference sites do.

---

## 4. Motion system for the app (and landing)

### Tokens (CSS)
```css
:root {
  /* durations */
  --dur-instant: 80ms;   /* press down */
  --dur-micro:   140ms;  /* hover colour, icon nudge (Linear 100–160) */
  --dur-short:   220ms;  /* press release, toggles, tooltips */
  --dur-base:    300ms;  /* standard UI change (Stripe's dominant) */
  --dur-enter:   640ms;  /* content arrival (Stripe 600–800, WMD 500–700) */
  --dur-panel:   700ms;  /* sheets, case drawer (Linear) */
  --dur-draw:   1200ms;  /* arcs, progress lines, highlight sweeps */
  /* easings (all measured on the reference sites) */
  --ease-micro: cubic-bezier(0.25, 0.46, 0.45, 0.94); /* Linear hover */
  --ease-out:   cubic-bezier(0.25, 1, 0.5, 1);        /* Stripe standard */
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);        /* Stripe expo-out */
  --ease-panel: cubic-bezier(0.32, 0.72, 0, 1);       /* Linear sheet */
  --ease-inout: cubic-bezier(0.65, 0, 0.35, 1);       /* Stripe long colour shifts */
  --ease-exit:  cubic-bezier(0.4, 0, 1, 1);           /* exits accelerate away */
}
```
Motion (framer `motion`) spring for press release: `{ type: "spring", stiffness: 520, damping: 32, mass: 0.6 }`, which settles in about 220ms with no visible bounce.

### States
- **Hover (pointer devices only, `@media (hover:hover)`):** background and colour shift at `--dur-micro --ease-micro`. Secondary affordances (row actions, arrow glyph +2px x) reveal on the same timing. Cards: **no lift and no shadow**. Instead, a 1px inner tone step plus a cursor-tracked radial highlight (`radial-gradient(240px at var(--mx) var(--my), rgb(255 255 255 / .06), transparent)` on dark; ink at 3% on light). This is the "responds to the cursor" requirement, kept quiet.
- **Press:** `scale(0.97)` over `--dur-instant`; release with the spring above. Primary pills also darken by one tone step. The marketing sites measured don't scale on press (all ✗), so apply this only to **in-app commands** (Run check, Draft appeal, Export, Send to physician), where physicality is the stated need. Never apply it to nav links or table rows.
- **Focus:** a 2px ring offset 2px in ink, appearing at `--dur-micro`. Never animate the ring's size.
- **Disabled/blocked (export gate):** do not grey out silently. On click, the button does a 3-cycle horizontal shake (±3px, 240ms total) and the offending quote row scrolls into view with an amber highlight sweep (`--dur-draw`). This is the one place a "no" gets motion.

### Loading and progress (real pipeline steps, not spinners)
| Wait | Feedback |
|---|---|
| < 300ms | Nothing. Never flash a spinner. |
| 300ms–2s | The button label crossfades to a verb ("Checking…") with an inline 2-stroke progress arc. Width is locked so the layout doesn't jump. |
| > 2s (live pipeline: seconds to minutes) | A **step stream**: a vertical list of the real stages (`Reading letter` → `Fetching L34220 (v40, in effect on DOS)` → `7 rules found` → `Matching evidence 3/7` → `Checking quotes` → `Gate passed`). Each row enters at `--dur-enter --ease-enter`; the current row shows a thin indeterminate bar; finished rows tick to a glyph. Counts use `@number-flow/react` so numbers roll rather than jump. This is Vercel's deploy-log idea in our domain, and it is honest progress. |
| Precomputed showcase run | Replay the same step stream using the **recorded step timings compressed to about 4–6 s total**, so a judge sees the work happen without waiting. Label it "Replay of a saved run". |
| Content loading | Skeletons in the exact final layout (bars at real line widths), shimmer at 1.4 s linear with 4% contrast, replaced by a 200ms crossfade. |

Success: the verdict chip arrives last with a single 900ms ring pulse (the same gesture as the globe's verified dot), and the state holds. No confetti, no toasts for things already visible on screen. Use `sonner` toasts only for off-screen events ("Appeal exported").

### Choreography rules
1. **One ambient motion per viewport.** If the globe is visible, nothing else loops.
2. **Ambient cycles ≥ 5 s, rotations ≥ 30 s.** Anything faster draws the eye away from content.
3. **Order of arrival matches meaning:** heading → verdict → evidence → actions. Stagger 50ms per item, at most 6 staggered items (later items enter together), and the whole entrance completes in 900ms or less.
4. **Enter from 12px below with opacity 0 to 1.** Never from the sides, except panels (from the right, `--dur-panel --ease-panel`).
5. **Exits run at 60% of the entrance duration with `--ease-exit`.** Leaving shouldn't hold attention.
6. **Animate only `transform`, `opacity`, `clip-path`, `stroke-dashoffset`.** Never animate width/height/top. For layout changes use motion's `layout` prop.
7. **Never move what the user is reading or typing.** No re-sorting a worklist while the pointer is over it; queue the change and apply it on pointer-leave.
8. **Scroll (landing only):** reveals trigger at 15% visibility, once, never on scroll back up. Lenis smooth scroll with `lerp: 0.1`; disabled in the app.
9. **Reduced motion:** honour `prefers-reduced-motion: reduce` everywhere. Durations go to 0 except opacity crossfades (≤150ms), ambient visuals render one still frame, and the step stream still appears (it is information, not decoration).
10. **Mobile:** no cursor effects, and press scale stays. Ambient visuals run at 35% opacity and smaller size.

---

## 5. Landing page outline (copy direction)

Copy rules: an H1 of at most 7 words; a sub of at most 18 words; each section is an H2 of at most 8 words plus at most 25 words of body. Write concrete nouns from the domain (denial letter, CARC code, LCD, date of service, chart note), never "streamline / revolutionize / AI-powered / seamless / unlock". No emoji. Numbers only from the fact-checked set in the README/Devpost draft.

0. **Nav (ruled, 64px):** wordmark · `How it works` · `Policy watch` · `Sign in` · black pill `Open workspace`.
1. **Hero:** left 55% text, right 45% policy globe (A) bleeding past the nav rule.
   - Mono eyebrow, built from real data: `LCD L34220 · VERSION IN EFFECT ON DATE OF SERVICE`.
   - H1 options:
     - "Quote the policy back to the payer."
     - "Every denial cites a rule. So should you."
     - "Appeals built from the payer's own words."
   - Sub: "Reads the denial, fetches the live policy, checks each rule against the chart. Exports only verified quotes."
   - Buttons: `Open a denial` (black pill) · `Watch a case resolve` (text link; it scrolls to the gate).
   - The Stripe-style live line under the buttons is a real number from our state: `Policies last checked for changes 6 h ago` (from `/api/drift`), ticking up.
2. **Proof strip:** three ruled mono cells (WeMakeDevs). Use eval numbers only, e.g. `7/7 policy rules found (3 of 3 runs)`, `0 unverified quotes exported`, `Deadlines from a fixed rules table`.
3. **The gate (C, scroll-pinned):** H2 "A quote that doesn't match doesn't ship." Then the product's real export panel: one quote passes, one with a changed word is blocked, and the button shakes.
4. **Five outcomes:** one horizontal ruled band, not five cards. Each cell has a glyph, a word (`Appeal`, `Ask the physician`, `Not yet`, `Fix and resubmit`, `Not winnable`) and the one-line rule that produces it. A highlight sweeps across the cells on reveal.
5. **How it works (pinned, 4 steps):** the right side is the real case screen (letter → rules → evidence → appeal), cropped like Linear and Stripe, morphing between steps; the left side has a 6-word caption per step.
6. **Before you submit:** prevention mode in two sentences, with the timeline graphic showing the earliest qualifying date.
7. **Policy watch:** the coverage map (B) as a small figure; "Nightly check against the live CMS and Aetna text."
8. **Ground rules:** four mono lines with no illustration: synthetic patients only · a human sends every appeal · sources linked by name · CPT® AMA attribution line.
9. **Final CTA + footer:** `Open the workspace`. Footer: team Road House, the repo link, NVIDIA Nemotron on Nebius Token Factory, Tavily.

**Mock login (Vercel pattern):** a centred card on the ground. H2 "Sign in to your workspace". One prefilled field "Workspace: Road House Imaging (synthetic)", a black pill `Continue`, and a mono line "Demo workspace · synthetic patient data only". The press uses the step stream in miniature (`Loading worklist · 12 denials`) for about 700ms, then the worklist enters with the stagger rules.

---

## 6. Palette and type direction

The current `ui/src/index.css` is stock shadcn neutral (oklch greys, `--radius 0.625rem`), which is the "template" signal. The project's established semantics (CLAUDE.md) are flat grey ground #EDEDEC, white surfaces, black pills, yellow #F9B91C as the one highlight, blue #1E4BD7 meaning only "verified", status colours always paired with a glyph and a word, and no violet. The direction below keeps those semantics and makes them specific to the domain rather than generic.

**Idea: "toner and highlighter".** Denials arrive as faxed letters, black toner on grey paper, and billers mark them up with a highlighter. The reference sites all run greyscale chrome with one or two single-job accents (§2), and this palette does the same with accents that come from the job.

| Token | Value | Job |
|---|---|---|
| `--ground` | `#EDEDEC` | page (flat, no gradient) |
| `--surface` | `#FFFFFF` | cards, separated by tone step only |
| `--surface-sunk` | `#E4E4E2` | wells, table headers, skeletons |
| `--ink` | `#0E0F0C` (warm toner black) | text, pills |
| `--ink-2` | `#55574F` | secondary text |
| `--ink-3` | `#8C8E86` | tertiary, rules at 20% |
| `--rule` | `rgb(14 15 12 / .08)` | hairlines and rails |
| `--verified` | `#1E4BD7` | **only** "quote verified / rule met with evidence" |
| `--highlight` | `#F9B91C` | the one highlight card, and the sweep behind quoted policy text (as a highlighter) |
| `--ask` | `#C27A06` amber + ○ glyph | missing documentation / ask physician |
| `--block` | `#C2361B` red + ✕ glyph | blocked / not winnable |
| `--ok` | `#1F8A4C` green + ✓ glyph | deadline safe |
| `--night` | `#0B0C0A` | the one dark band (globe hero or the gate section) |

Dark/light choice: 4 of the 6 sites use dark heroes, and the globe reads best on dark. CLAUDE.md, though, sets a **light** system. I recommend keeping the app and landing light, with **one `--night` band** for the hero globe. This is the one open decision; it needs the user's sign-off before build. On light, the sphere is ink dots at 70% on `--ground` with blue and amber markers, which works because the dots are ink, as in Stripe's light globe section.

**Type:**
- Display/UI: keep **Switzer** (self-hosted, user-chosen). Display at **300–400**, 56–72px, line-height 1.0–1.05, tracking −0.035em. This is between Stripe's light weight and Vercel's tight tracking, and the light-weight, large-size combination is the premium signal measured on Stripe and Vercel. UI body 15px/24px at 400 (Linear's body size).
- Second voice: a mono for eyebrows, section indexes (`01 / GATE`), policy IDs, CARC codes, dates, counts and globe labels. Candidates: **IBM Plex Mono** (OFL, reads as institutional/forms, which suits claims work) or **JetBrains Mono**. Avoid Geist Mono, which is Vercel's voice and would read as borrowed. Uppercase mono at 11–12px with +0.06em tracking.
- Policy quotes: set verified quotes in the mono at 14px on a `--highlight` sweep (a 30%-opacity bar drawn left to right over `--dur-draw` when verified). The highlighter metaphor then carries the product's key invariant visually.
- Numerals: `font-variant-numeric: tabular-nums` everywhere numbers update (number-flow).

**Anti-template devices** (from the measured patterns):
- Visible 1px rails at the container edges plus ruled section dividers with mono indexes (Stripe/WMD/Linear).
- Real product UI as every illustration, cropped and fading into the ground with a mask, never an icon-plus-title card.
- Two-tone headlines (Stripe): the claim in `--ink`, the elaboration in `--ink-2`, at the same size.
- One highlighted phrase per section at most (Resend's single amber phrase becomes our yellow highlighter sweep).
