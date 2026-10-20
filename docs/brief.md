# Brief: Nebius x NVIDIA Global AI Hackathon

Source: https://nebiusglobalaihackathon.devpost.com/ (overview, /rules, /resources), read 2026-10-20.
Sponsor: Nebius B.V. Administrator: Devpost. Online, public, **~24,700 registered participants**.

## Dates (Pacific Time)

| | |
|---|---|
| Submission period | Aug 26, 2026 9:00 am → **Fri Oct 30, 2026 10:00 am PT** |
| Judging | Dec 1 → Dec 15, 2026 |
| Winners announced | ~Jan 11, 2027 |

No changes can be made after the deadline. Drafts can be saved on Devpost before then.

## Hard requirements (Stage One is pass/fail on these)

> "Entrants must create a working software application that runs on either Nebius Token Factory or Nebius AI Cloud and uses at least one NVIDIA open source model, and that fits into one of the four hackathon tracks below."

> "Runs on Nebius Token Factory or Nebius AI Cloud" means the project makes a runtime call to the Token Factory inference API, or is deployed/run using Nebius AI Cloud compute (Serverless Jobs, Serverless Endpoints, or DevPods).

> "A Project reasonably fits the theme if it is a genuine attempt at the track's stated goal, not a superficial rebrand of an unrelated idea."

## Tracks (verbatim)

- **Coding and Agentic Engineering:** "Build coding agents and developer tools: agents that write, run, and test code in Token Factory."
- **Best Apps and Agents:** "Build any app or agent someone would actually use, from a productivity tool or copilot to a workflow that runs itself. Power it with Nemotron models on Nebius through Token Factory. Reach for Nemotron 3 Ultra when you need serious reasoning, and let Nano or Super handle the fast, everyday calls, so your app stays responsive and your credits stretch further. We encourage you to deploy your application with Nebius Serverless Endpoints, or use Nebius Serverless Jobs for background processing and asynchronous workflows, though neither is required."
- **Personal AI:** "Build an always-on, private assistant that works for you while keeping your data under your control. Give it persistent memory, reusable skills, access to the tools and information you choose, and the ability to carry out tasks across your daily workflows. Use at least one NVIDIA open source model, and use tools such as NVIDIA NemoClaw, OpenShell, Hermes Agent, and Nebius Serverless to bring personal AI to assemble, secure, and run your own personal AI system."
- **Physical AI:** "Build embodied and edge agents that sense and act in the real world: robotics, IoT, and on-device intelligence, powered by Nemotron, GROOT, Cosmos and Sonic models and coordinated through an agent runtime. Use Nebius Serverless Jobs to run simulations, generate synthetic data, evaluate robot policies, or process sensor data at scale, and Nebius Serverless Endpoints to serve real-time inference when needed." Video must include ≥1 min of hardware operating (or key modules if no hardware).

## Required submission items (coverage checklist)

- [ ] URL to a working demo, hosted app, or test build (not required for Physical AI). Free and unrestricted access until judging ends; include login credentials if private.
- [ ] Public repo URL (GitHub/GitLab/Bitbucket) with all source, assets and instructions needed to run it.
- [ ] OSI open-source license file, detectable in the repo's About section (MIT / Apache 2.0 / MPL 2.0).
- [ ] Text description highlighting **how NVIDIA Nemotron / other NVIDIA open models were used, where Token Factory accelerated the workflow**, and any other Nebius tools or services used.
- [ ] Demo video **< 3 minutes**, public on YouTube; no third-party trademarks or copyrighted music without permission.
- [ ] Track selection.
- [ ] Feedback on Token Factory, AI Cloud and NVIDIA tools/models used (also enters the "Most Valuable Feedback" prize).
- [ ] If the project existed before Aug 26: an explanation of what was significantly updated. (Not applicable; the repo is new.)
- [ ] All materials in English.

## Judging (Stage Two, equal weights)

1. **Technological Implementation:** How well is the project built, and how effectively does it use Nebius Token Factory or AI Cloud model(s), and NVIDIA Nemotron or other NVIDIA open source models as part of the solution?
2. **Design:** Does the project deliver a complete, coherent product experience, not just a technical proof of concept?
3. **Potential Impact:** Does the project make a credible, specific case for solving a real problem for a real audience, and does the solution actually address it based on what's demonstrated?
4. **Quality of the Idea:** Is this a creative, non-obvious use of Token Factory / AI Cloud and Nemotron or other NVIDIA open models, and does the team show genuine understanding of the problem space?

Tiebreak: the earlier criterion wins. Judges are not required to test the app and may judge only from the description, images and video, **so the video carries the submission**.

## Prizes

| Prize | Amount |
|---|---|
| Grand / 2nd / 3rd | $20,000 / $10,000 / $6,000 |
| Track winner (×4) | NVIDIA Jetson Orin Nano each |
| Best Use of Tavily | $3,000 (functional runtime Tavily call) |
| City Winner (×20) | $500 (Builders & Brews attendees only) |
| Most Valuable Feedback (×10) | $100 + NVIDIA swag |

One Overall **or** one Track award, **plus** one Bonus award per project.

## Judges (23)

Mostly NVIDIA engineers (Jetson, Physical AI, software), Nebius Token Factory / DevRel / product staff (incl. Serverless AI PM, Physical AI GTM), and two Tavily forward-deployed engineers plus Tavily DevRel.

## Team & constraints

- Team: **Fine Print**: Aman Bihari, Bhawna. Strengths: Python backend, ML/data. No dedicated frontend skills, so prefer a simple, polished UI (e.g. Streamlit/Gradio or a minimal template).
- Hardware: phone/webcam, plus access to an **NVIDIA A100 container** (JupyterLab on the local network; the credentials are not stored here). Good for self-hosting open NVIDIA models that aren't on Token Factory (e.g. Cosmos Reason 2), fine-tuning and evals. It **does not satisfy the "runs on Nebius" rule**, so the shipped app must still call Token Factory. A100s also can't run Isaac Sim (no RT cores).
- Decision: the user picks from the top 3 finalists.
- Budget caps (enforced in code): Token Factory $27 total; Tavily 4,125 credits total.
- Models on the key: Nemotron 3 Nano 30B-A3B, 3 Super 120B-A12B, 3 Ultra 550B-A55B, 3.5 Lightning, 3.5 Super-VL (vision).
- Build time: 10 days (Oct 20 → Oct 30).
- Toloka and Tandem: excluded by the user.
