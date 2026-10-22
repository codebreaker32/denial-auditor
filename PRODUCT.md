# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Custom web frontend (user decision, 2026-10-22): FastAPI backend serving hand-built HTML/CSS/JS over the existing Python pipeline (`src/nebius_nvidia/`) and precomputed case runs (`demo/runs/`). Replaces the Streamlit prototype in `app/`. Deployed as one container on AWS Lightsail.

## Users

Primary: **billing specialists at small medical practices** (2–10 physicians) in the US, working a queue of health-insurance denials for outpatient MRI/CT imaging. Their job: decide which denials are worth fighting, gather the policy and chart evidence, get missing documentation from the physician, and send a reconsideration request before the deadline. They are not clinicians or lawyers; they work fast, against volume and deadlines, and must be able to defend every claim in a letter.

Secondary (evaluation context, not the design target): hackathon judges who see the product through a sub-3-minute video, the hosted demo and the write-up.

## Product Purpose

Denial Auditor turns an insurance denial into a decision and a defensible next step. It reads the denial letter, triages it (administrative fix / plan exclusion / clinical), fetches the payer's coverage policy **in effect on the date of service**, splits it into rules, checks each rule against the chart with quoted evidence, and returns one of: appeal (with a drafted letter), ask the physician (with a documentation request), don't appeal yet, fix and resubmit, or not winnable. Success: a biller resolves a denial in minutes instead of hours and every quote in the outgoing letter is real.

## Positioning

"Payers check your MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same." Payer-side tools (Availity, Cohere, Anterior, eviCore) already match chart evidence to policy criteria; provider-side tools mostly generate appeal letters for health systems. Denial Auditor gives a small practice the payer's criterion-level view, with every quoted policy and chart line verified word for word (export is blocked otherwise) and the policy version pinned to the date of service. It can also say "don't appeal yet" instead of always writing a letter.

## Operating Context

- Inputs: a faxed/scanned denial notice (PDF/PNG) or its text, and the patient's chart notes. Outputs: an editable appeal letter (Markdown export), a documentation request to the physician, or a fix checklist.
- Policy sources: CMS Coverage API (Medicare LCDs, versioned; e.g. L34220 Lumbar MRI), Aetna Clinical Policy Bulletin 0236 (located at runtime via Tavily search; dated snapshot).
- Deadlines come from a fixed table verified against federal regulations (42 CFR 422.582, 405.942; 45 CFR 147.136; 29 CFR 2560.503-1), counted from the notice date.
- Models: NVIDIA Nemotron 3 Nano / Super / Ultra and 3.5 Super-VL on Nebius Token Factory; cost per case is a few cents and is shown.
- Demo: precomputed showcase cases are free to browse; live runs need a passcode and are rate-limited.

## Capabilities and Constraints

- Synthetic patient data only. No real PHI anywhere (repo, demo, video).
- A human always reviews and sends the appeal; the tool never submits anything.
- An appeal cannot be exported unless every quote matches a source fetched in that session.
- CPT shown as bare codes only, never AMA descriptors; AMA attribution line wherever codes appear.
- Never quote, store or send to a model eviCore, Carelon or ACR text (link by name only).
- Never claim inputs are "never trained on".
- Terminology: "denial", "reason code", "date of service (DOS)", "coverage policy", "rule/criterion", "evidence", "appeal / reconsideration", "documentation request".
- Undecided: multi-user accounts, EHR integration, real-data workflows (post-hackathon).

## Brand Commitments

- Product name: **Denial Auditor**. Team: **Road House** (Aman Bihari, Bhawna).
- Voice: plain, precise, unhype; says what the policy says and what is missing. No legal or medical advice.

## Evidence on Hand

- 30 synthetic cases (`cases/`), 7 scenario groups; precomputed runs (`demo/runs/`).
- Eval results (`eval/results/`): triage 24/24; verdict accuracy 83% on 24 clinical cases (current rules); gold criterion status 93%; criteria extraction 7/7 gold in 3/3 runs; citation gate blocks tampered quotes in tests.
- Sourced statistics (to be fact-checked before public use): KFF 2024 MA data (80.7% of appeals overturned, 11.5% of denials appealed); HHS OIG OEI-09-18-00260 (13% of MA prior-auth denials met Medicare coverage rules). No customers, testimonials or pilots exist; never fabricate them.

## Product Principles

1. Every claim is traceable: a verdict shows the rule, the policy's own words, and the chart sentence behind it.
2. Code decides what must be certain (quotes, dates, deadlines, verdict rule); models do judgment, and their judgment is shown, not hidden.
3. Say "not yet" when that's the truth: the best outcome is sometimes a documentation request, not a letter.
4. The biller stays in charge: review, edit, send.
5. Respect source terms: quote briefly, attribute, link.

## Accessibility & Inclusion

Office desktop use for long sessions: high legibility, keyboard-operable lists and actions, status never conveyed by color alone, WCAG 2.2 AA contrast.
