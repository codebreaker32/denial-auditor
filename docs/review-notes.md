# Deck review notes (simulated judging)

The deck is `deck/src/index.html`, built to `deck/out/Denial_Auditor_Road_House.pdf` with `cd deck && PDF_NAME=Denial_Auditor_Road_House.pdf npm run -s build`.

## Round 1 (2026-10-26): rubric judge 74/100, impeccable finish reviewer, fact auditor

**Applied:**
- Demo URL on the cover and on page 12.
- Deadline explained as 60 days from presumed receipt (notice + 5), with the contracted-provider caveat.
- Aetna kept as a dated snapshot, with no past versions claimed.
- The Nano comparison names its confound: model and sample count change together.
- "Settled in code" defined (red-flag rules on a chart with no verified red flag).
- The gate checks quotes, not prose.
- The x-ray point cites 42 CFR 422.101(b)(3) and (b)(6).
- Scope stated, and a "Why Token Factory" strip added.
- Tavily named on the policy page.
- Kickers removed and Model / Code / Cost rows normalised.
- Unicode check replaced with an SVG mark.
- Crops recaptured for legibility.
- Qualifiers: prior-auth vs payment denials, HealthCare.gov only, and the 13% sample.
- Exact denial wording, and answer names that match the UI.
- Call breakdown 28 Super + 1 Ultra; 410 checks counted over 24 clinical cases; 7/7 scoped to L34220 v40.
- Full AMA line, plus disclosures: Nemotron-written notes, Apache-2.0, fictional Aetna notices, AI coding assistant.

**Not done:**
- Documentation-request screenshot. No showcase case currently ends in a documentation request.
- A Super single-sample arm to separate the confound (~$0.75). The slide states the confound instead.

## Round 2 (2026-10-26): rubric judge 81/100, fact auditor

**Applied:**
- **Page 8 (critical):** the Code row now says the 1-of-22 crop is a deliberate four → two edit, and that the real letter passes 22 of 22.
- **Page 2:** headline qualified to prior-auth denials; the 13% figure carries its sample and audit year.
- **Page 7:**
  - the timeline replaces the header crop;
  - the deadline is named as the MA reconsideration window;
  - the inline pill is dropped.
- **Page 9:**
  - column renamed "Nano matcher, one sample" (intake and criteria stayed on Super in that run);
  - row renamed "Hand-labeled rule statuses";
  - "Honest scope" renamed "What this shows".
- **Page 10:**
  - a prior-auth timeline crop added;
  - the caption explains why "Not yet" sits beside an earliest date that falls before the scan.
- **Page 11:** Nano's reasoning-off speed applies to text-notice intake; chart facts run with reasoning on.
- **Page 12:**
  - scope corrected: unsupported payers and states are refused, but CPT isn't checked, so the slide says only 72148 is tested;
  - setup line added;
  - demo and repo links are clickable.
- **Page 6:** one large rule crop, the mid-sentence tick removed, footer reworded.
- **Page 5:** caption says S48 is selected.

**Rejected or deferred:**
- An explanation of Nano's 90 s vs Super's 72 s. The cause isn't measured, so the slide states no cause.
- Tighter top crop on page 10. Its timeline now carries the point.
- Nested card borders on the page 8 crops. Cosmetic.

**Open for the team:**
- Is a public, prize-eligible demo still "personal, non-commercial" use under the CMS/AMA licence terms?
- "Prosper Health MA" may be a real plan name; consider renaming the synthetic payers.
