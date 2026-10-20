# Denial Auditor: competitive and market research

Researched 2026-10-20. Every claim links to a page that was actually opened or returned in search during this session. **Vendor claim** means the number comes from the company's own marketing and has not been independently checked. **Secondary** means it comes from trade press or a blog, not the primary source. **Unverified** means no primary confirmation was found.

---

## TL;DR

- **Criterion-level matching of chart evidence against policy text already exists, but on the payer side.** Availity AuthAI (now "Intelligent Utilization Management") encodes the plan's medical policy in CQL. Cohere Health applies plan policies through "codification logic". Anterior's Florence checks requests "against the plan's clinical criteria". All three are sold to health plans.
- **Provider-side tools are mostly appeal-letter generators sold to hospitals and health systems.** Examples are Waystar AltitudeCreate, SmarterDx SmarterDenials, R1 Phare, Epic Penny, and Experian AI Advantage, which handles triage only. None of the pages I saw publicly claim three things: (a) a criterion-by-criterion evidence board against the payer's policy text, (b) exact-match verification of quoted chart or policy text, or (c) citing the policy version in effect on the date of service.
- **Small practices are underserved.** 47% of physicians still work in practices of 10 or fewer physicians. Only 14% of providers use AI for claims. Prior authorization is MGMA's #1 regulatory burden. MA denials are overturned about 81% of the time, yet only about 11.5% are appealed.
- **Regulatory tailwinds are real.** CMS-0057-F requires a specific denial reason (since Jan 2026) and a Prior Authorization API listing the documentation each payer requires (Jan 2027). CMS-4201-F requires MA plans' internal coverage criteria to be publicly accessible. The CMS Coverage API exposes LCD revision history, which supports date-of-service versioning for Medicare.

---

## 1. Competitor landscape

Legend for the three product questions:
- **Crit** = criterion-level evidence matching against payer policy text
- **Cite** = verified citations
- **Small** = serves small (2–10 physician) practices

"Not claimed" means the pages I saw do not mention it. It does not prove the feature is missing.

### Provider-side denial and appeal tools

| Company / product | What it actually does | Sold to | Price / min size | Crit | Cite | Small |
|---|---|---|---|---|---|---|
| **Waystar**: Denial + Appeal Management, AltitudeAI / AltitudeCreate | Prioritizes the denials most likely to be overturned and routes them to work groups. Generates and submits appeal packages from 1,000+ payer-specific forms. AltitudeCreate (launched Jan 2025) uses GenAI to write appeal letters and was included at no extra cost for existing denial-module customers. Vendor claims: 40% higher overturn rate, up to 40 min saved per appeal. [Waystar](https://www.waystar.com/our-platform/denial-prevention-recovery/denial-appeal-management/), [Medical Economics](https://www.medicaleconomics.com/view/new-ai-can-autonomously-help-physicians-generate-appeal-letters-for-denied-claims) | Health systems and hospitals. The site navigation also lists physician/specialty practices and billing services. | Custom quote, no public price | Not claimed. The page mentions payer forms and "payer rules" but no criteria matching. | Not claimed | Partially (segment listed, no size info) |
| **Experian Health**: AI Advantage (Predictive Denials, Denial Triage) | *Predictive Denials* runs before submission: ML learns from payer adjudications, detects "undocumented payer rule changes" and flags high-risk claims. *Denial Triage* runs after denial: it scores each denial's likelihood of reimbursement and sorts denials into 2–10 segments. It does not draft appeals or look at clinical evidence. Both tie into ClaimSource. [Experian blog](https://www.experian.com/blogs/healthcare/tag/ai-advantage-denial-triage), [Schneck case study](https://www.experian.com/blogs/healthcare/schneck-medical-center-prevents-claim-denials-with-ai/) (vendor claim: 4.6%/month denial reduction) | Hospitals / health systems (the case study is a hospital) | Not public | No (it scores claims, not clinical criteria) | No | Unverified |
| **R1 RCM**: Phare OS, R1 Denial Management | Agentic RCM platform. R1 says it "automatically analyzes medical records and supporting data to generate stronger, evidence-backed appeals" and has cut appeal times by up to 50% (vendor claim). Live with select clients, including Providence. [R1 newsroom](https://www.r1rcm.com/newsroom/r1-announces-phare-os-expansion-to-help-providers-navigate-growing-complexity-and-margin-pressure), [Becker's](https://www.beckershospitalreview.com/finance/revenue-cycle-management/r1-rcm-launches-ai-tools-for-ar-recovery-denials/) | Large health systems (outsourced RCM) | Not public | Partial ("evidence-backed"), not criterion-level as described | Not claimed | No evidence |
| **AKASA**: Authorization Advisor (Mar 2024) | GenAI assistant for prior-auth specialists. It suggests supporting documentation "with its evidence" and supports any payer portal and most EHRs. Vendor claims: up to 50% less PA time, 15% more relevant clinical documents found. 475+ hospitals and 8,000 outpatient facilities. No AKASA appeals product found. [AKASA press](https://akasa.com/press/akasa-launches-authorization-advisor) | Health systems | Not public | Partial: it surfaces evidence for submission, but no criterion-by-criterion mapping is claimed | Not claimed | No evidence |
| **SmarterDx / Smarter Technologies**: SmarterDenials (late 2024) | The user uploads the denial. The AI reads the full record (notes, labs, meds, orders, vitals) and drafts a clinical appeal letter in minutes, which a human edits. Targets DRG downgrades and level-of-service disputes, which are inpatient. [SmarterDx](https://smarterdx.com/news/smarterdx-launches-smarterdenials-ai-appeals-to-help-hospitals-fight-payer-denials) | Hospitals | Not public | Not claimed (letter generation) | Not claimed | No (inpatient/DRG focus) |
| **Thoughtful AI**: agents PAULA (prior auth), DAN (denials), and others | Named RCM agents. PAULA "covers the entire prior authorization process, from initial submission to appeals". Vendor claims: 98% first-pass resolution, denials reduced up to 75%. [BusinessWire PAULA](https://www.businesswire.com/news/home/20240919908218/en/Thoughtful-AI-Empowers-Healthcare-Providers-With-Prior-Authorization-RCM-AI-Agent-PAULA), [BusinessWire 2024 growth](https://www.businesswire.com/news/home/20241210584345/en/Thoughtful-AI-Announces-Its-Across-the-Board-Growth-in-2024-Expectations-for-2025) | Providers (mostly larger groups and health systems, per the customer framing). Unverified. | Not public | Not claimed | Not claimed | Unverified |
| **Infinitus**: voice agent "Eva" | AI phone agent that calls payers and PBMs for benefit verification and prior-auth status checks. Vendor claims: 5M+ conversations, 10% more accurate than manual callers. It handles phone calls, not evidence. [Infinitus payors page](https://www.infinitus.ai/solutions/payors/), [Infinitus health systems](https://infinitus.ai/solutions/health-systems) | Pharma, specialty pharmacy, health systems | Not public | No | No | No evidence |
| **Rivet Health** | Outpatient-practice RCM: patient cost estimates, underpayment detection, and Denials Appeal Management. Denials are auto-assigned to staff, and appeal forms are auto-populated via Healthjump EHR data. Vendor claims a 33% denial-rate reduction. [Rivet help](https://help.rivethealth.com/en/articles/8289202-what-is-rivet), [Rivet blog](https://www.rivethealth.com/blog/denial-appeals-process-in-medical-billing) | **Outpatient practices.** This is the closest incumbent to our buyer. | Capterra lists **"starting at $6,000/yr"** (third-party, unverified). [Capterra](https://www.capterra.com/p/205843/Rivet/pricing/) | No (workflow and forms, not clinical criteria) | No | **Yes** |
| **athenahealth**: athenaOne AI (roadmap of 80+ AI RCM features, Jun 2026) | AI for insurance selection, copay estimates, prior auth and denial resolution. Classifies denials, predicts resubmission success, runs an auth rules engine that checks whether auth is required, and uses AI voice agents for PA calls. Vendor claims: 16% fewer insurance-related denials, 30% more recovery on coding denials. [BusinessWire Jun 2026](https://businesswire.com/news/home/20260603429867/en/athenahealth-Raises-the-Bar-on-Revenue-Cycle-Management-Performance-with-80-AI-native-Features-Designed-to-Eliminate-Manual-Revenue-Cycle-Work), [TechTarget](https://www.techtarget.com/revcyclemanagement/news/366643899/Athenahealth-unveils-over-80-revenue-cycle-AI-features), [athena blog](https://athenahealth.com/resources/blog/reduce-administrative-burden-with-athenaone-ai-tools) | Ambulatory practices on athenaOne, including small ones | Bundled into the athenaOne subscription (pricing not public) | Not claimed (the rules engine decides *whether* auth is needed, not whether criteria are met) | Not claimed | **Yes, but only for athenaOne customers.** This is the biggest platform threat. |
| **Epic**: Penny (revenue-cycle AI, UGM Aug 2025), CRD in Payer Platform | Penny helps with coding and reportedly drafts appeal letters for denied claims (CEO statement relayed via CNBC; secondary). Epic is rolling out Da Vinci CRD so clinicians see payer requirements in workflow, and Payer Platform integrates Cohere's PA. [Healthcare IT News](https://www.healthcareitnews.com/news/epic-unveils-ai-agents-showcases-new-foundational-models), [Advisory Board](https://www.advisory.com/daily-briefing/2025/08/28/epic-meeting), [Becker's Epic+Cohere](https://beckershospitalreview.com/ehrs/epic-cohere-expedite-prior-authorizations.html) | Epic customers: health systems and large groups. Small practices reach Epic only through Community Connect. | Bundled | Not claimed | Not claimed | No (Epic-only) |
| **Infinx** | Patient-access automation plus human PA specialists, used in radiology (e.g., RadNet). It decides whether PA is needed, submits electronically, and predicts clinical-review need and turnaround time. Sources are 2019-era, so current product is unverified. [Healthcare IT News, RadNet](https://www.healthcareitnews.com/news/radnet-ai-fueled-prior-authorization-tech-shows-promise), [Radiology Business](https://radiologybusiness.com/scriptsender-and-infinx-healthcare-form-partnership-expedite-prior-authorization-requests) | Imaging centers and radiology groups (enterprise, e.g., RadNet) | Not public | Not claimed | No | No evidence |
| **Silna Health** ($27M total, Mar 2025) | AI for prior auth, benefit checks and eligibility for specialty providers (ABA, OT, cardiac rehab). [BusinessWire](https://www.businesswire.com/news/home/20250325542615/en/Silna-Health-Announces-27-Million-in-Funding-to-Tackle-Americas-Prior-Authorization-Crisis/) | Specialty outpatient providers | Not public | Not claimed | Not claimed | Plausibly (specialty clinics) |
| **ACEHOUND** (Oct 2025 nationwide launch) | AI plus industry experts for prior-auth *appeals*, focused on therapy and drug access. [BusinessWire](https://www.businesswire.com/news/home/20251007508376/en/ACEHOUND-Launches-Nationwide-Using-AI-and-Industry-Expertise-to-Streamline-Medical-Prior-Authorization-Appeals-Reducing-Care-Delays-Provider-Burden-While-Improving-Patient-Access-to-Needed-Therapies) | Providers (details unverified) | Not public | Unverified | Unverified | Unverified |
| **Develop Health** | AI medication-access tool (PA, benefit verification). Aggregator lists a $14.3M Series A in Aug 2025, which is unverified. [vcbacked](https://www.vcbacked.co/company/develop-health) | Drug/medication PA, not imaging | — | — | — | — |

### Payer-side tools (these do criterion-level matching, for the other side)

| Company | What it does | Customer | Notes |
|---|---|---|---|
| **Cohere Health**: Complete Diagnostic Imaging (delegated UM) | Runs imaging prior authorization end to end *on behalf of health plans*. It applies plan policies through "codification logic" plus clinical AI. Vendor claims: 85% real-time approvals, 90% auto-approvals. Humana extended Cohere to imaging and sleep. It also partners with MCG to bring MCG guidelines into decisioning. [Cohere imaging](https://www.coherehealth.com/utilization-management/delegated/diagnostic-imaging), [Radiology Business, Humana](https://radiologybusiness.com/topics/healthcare-management/healthcare-economics/humana-expands-use-automated-prior-authorization-software-diagnostic-imaging), [MobiHealthNews, MCG](https://www.mobihealthnews.com/news/cohere-health-mcg-health-partner-address-prior-authorization-process) | Health plans | **Direct proof that imaging criteria can be codified and machine-checked.** Providers only get Cohere's intake portal. |
| **Availity**: AuthAI, now "Intelligent Utilization Management" | Encodes the health plan's medical policy in **CQL**, applies it to clinical data, gives "traceable and auditable" recommendations, and arranges the evidence for human review. It "does not auto-deny". [Availity AuthAI](https://www.availity.com/authai/), [TechTarget, Abridge+Availity](https://www.techtarget.com/healthcarepayers/news/366637050/Abridge-partners-with-Availity-for-AI-powered-prior-authorizations) | Payers. Providers get the free Availity Essentials portal for submitting auths. [Availity authorizations](https://availity.com/authorizations) | This is the closest analogue to our criterion board, but it is built for payers. |
| **Anterior**: "Florence" | Clinical-review AI for payers. It checks requests against the plan's clinical criteria, digitizes policies into machine-readable logic, and offers a clinician dashboard of AI summaries and evidence. A vendor case study with WNS-HealthHelp claims about 75% auto-approval and 99.24% accuracy. $20M Series A (Jun 2024). [BusinessWire](https://www.businesswire.com/news/home/20240610719247/en/Anterior-Secures-20-Million-Series-A-to-Unlock-Administrative-Efficiencies-for-Healthcare-Payers), [HealthHelp case study PDF](https://www.healthhelp.com/wp-content/uploads/Points-of-Light-2025-Case-Study-25-Final.pdf) | Payers / UM vendors | — |
| **eviCore** (Cigna) | RBM for advanced imaging. Its AI "dial" can auto-approve but not deny; flagged cases go to nurses and doctors. ProPublica/Capitol Forum (Oct 2024) reported denials of about 20% in Arkansas since 2021, vs about 7% for MA in 2022. [ProPublica](https://www.propublica.org/article/evicore-health-insurance-denials-cigna-unitedhealthcare-aetna-prior-authorizations) | Payers | The adversary. Its guidelines are what we parse. |

### Patient-side appeal tools (adjacent, not competitors for the billing-staff buyer)

- **Fight Health Insurance** (Holden Karau): free. It extracts the denial rationale and drafts several appeal letters, using an in-house model tuned from a Mistral base. [SF Standard](https://www.sfstandard.com/2024/08/23/holden-karau-fight-health-insurance-appeal-claims-denials/)
- **Counterforce Health**: free. It analyzes the denial letter, the policy and medical research to draft an appeal, and has a clinic version with voice agents. The company says it has helped about 20,000 people (unverified). [Axios](https://www.axios.com/local/raleigh/2025/08/20/using-ai-to-fight-back-against-insurance-denials-counteforce), [WECT](https://www.wect.com/2025/07/25/ai-tool-that-helps-patients-battle-insurance-claim-denials-got-its-start-wilmingon)
- **Claimable**: about $40 per letter (secondary). [newsletter](https://beginnersinai.beehiiv.com/p/71-of-health-insurers-are-using-ai-to-decide-your-claims)

---

## 2. The gap: small and independent practices

- **The segment is still large.** In 2024, **47%** of physicians worked in practices with 10 or fewer physicians, the first time below 50% (AMA Benchmark, via Fierce, secondary). **42.2%** worked in physician-owned private practices, down from 60.1% in 2012. [AMA Benchmark](https://www.ama-assn.org/about-ama/research/physician-practice-benchmark-survey), [Fierce Healthcare](https://www.fiercehealthcare.com/providers/doctors-continue-shift-away-private-practice-citing-insurer-payment-and-regulatory-issues)
- **Prior-auth burden (AMA 2025 survey, 1,000 physicians, released May 13 2026):** 40 PAs per physician per week and **13 hours/week** of physician and staff time. **32%** say requests are often or always denied. 74% say denials increased over 5 years. 40% employ staff who do nothing but PA. 26% report a serious adverse event. 60% worry AI will increase denials. Only 33% think the June 2025 insurer pledge will matter. [AMA press release](https://www.ama-assn.org/press-center/ama-press-releases/ama-survey-prior-authorization-reform-pledge-falls-short-physicians), [AMA survey page](https://www.ama-assn.org/practice-management/prior-authorization/ama-prior-authorization-physician-survey)
  - The prior (2024) AMA survey reported 39 PAs/week, 13 h, and 27% often/always denied (secondary). [AMA](https://www.ama-assn.org/practice-management/prior-authorization/fixing-prior-auth-40-plus-prior-authorizations-week-way-too)
- **MGMA:** prior authorization is practices' **#1 regulatory burden** going into 2025. [MGMA 2025 PA issue brief](https://mgma.com/getkaiasset/94ea127c-8184-4faa-b2ea-e2e32a06f14c/MGMA%202025%20Prior%20Authorization%20Issue%20Brief.pdf), [MGMA article](https://www.mgma.com/articles/the-prior-authorization-landscape-in-2025). The MGMA 2026 Regulatory Burden Report again names PA, MA requirements and quality reporting as the top issues. [MGMA 2026 report](https://www.mgma.com/getkaiasset/8c7263b8-882d-4f6a-8d6c-48180fba72c9/MGMA%202026%20Reg%20Burden%20Report%20.pdf). In a March 2024 MGMA Stat poll, **60%** of groups reported higher denial rates than a year earlier. [MGMA Stat](https://mgma.com/mgma-stat/strategic-improvements-in-your-rcm-to-reduce-your-practices-claim-denials)
- **Low AI adoption:** Experian's State of Claims 2025 (250 respondents, Sep 2025) found that **41%** of providers have denial rates of 10% or more and **only 14% use AI** in claims. 35% cite authorization issues as a root cause. This is a vendor survey. [Experian press](https://experianplc.com/newsroom/press-releases/2025/experian-health-s-3rd-annual-state-of-claims-survey-finds-denial)
- **Outsourcing:** no 2024–2026 MGMA figure on the share of practices that outsource billing was found, so this is **unverified**. Older undated MGMA citations say 13–17% (secondary). [Becker's](https://www.beckersasc.com/asc-news/8-things-to-know-on-physician-practice-revenue-cycle-management-outsourcing/). An MGMA Stat poll cited secondhand says 36% planned to outsource *or automate* part of RCM in 2025 (unverified).
- **Pricing and access signal:** the enterprise tools (Waystar, Experian, R1, AKASA, SmarterDx) are custom-quoted and their case studies are hospitals and health systems. Small practices get either an EHR-bundled feature (athenaOne) or workflow tools like Rivet (third-party listing: about $6K/yr) that do no clinical-criteria matching.

---

## 3. Imaging specifically

### How often imaging needs prior auth or gets denied
- In a JAMA Network Open survey of 178 cancer patients (MSK, 2022 data), **imaging was the service that most often required PA (71%)**, ahead of IV chemo (49%). [Radiology Business](https://radiologybusiness.com/topics/healthcare-management/healthcare-quality/prior-authorization-imaging-causing-anxiety-administrative-burden-cancer-patients)
- **OIG OEI-09-18-00260** names advanced imaging (MRI) as a category of wrongly denied MA requests. One cause was plans "requiring an x-ray before approving more advanced imaging" when Medicare does not require it. See section 4. [OIG](https://oig.hhs.gov/reports/all/2022/some-medicare-advantage-organization-denials-of-prior-authorization-requests-raise-concerns-about-beneficiary-access-to-medically-necessary-care/)
- **eviCore** denials ran about 20% in Arkansas since 2021 (ProPublica). [ProPublica](https://www.propublica.org/article/evicore-health-insurance-denials-cigna-unitedhealthcare-aetna-prior-authorizations)
- In an orthopedic clinic study of CT/MRI denials, **95.1%** were ultimately approved after peer-to-peer review, but care was delayed. [Hackensack Meridian](https://www.hackensackmeridianhealth.org/en/info/ortho/mri-ct-denial-approvals)
- No national 2024–2026 denial rate specific to MRI/CT was found (**unverified**).

### Radiology benefit managers (RBMs)
- **Evolent (RadMD, formerly NIA):** non-emergent outpatient CT/CTA, MRI/MRA, PET, MUGA, CCTA and MPI require PA through Evolent for many plans. ER, observation and inpatient care are excluded. Retro requests are allowed within 90 days of the date of service. An authorization "is not a guarantee of payment". [RadMD Wellcare DE FAQ 2026](https://www1.radmd.com/sites/default/files/2026-01/Wellcare%20of%20Delaware%20Advanced%20Imaging%20FAQ%20RO%2001012026.pdf), [BlueChoice scope](https://www1.radmd.com/sites/default/files/2026-06/Evolent%20Scope%20of%20Service_BlueChoice_Advanced%20Imaging.pdf)
- **eviCore (Cigna):** CT, CTA, MRA, MRI, nuclear medicine, PET and PET-CT for plans such as Highmark. Its guidelines are a blend of Medicare, best practice and InterQual. Guideline sections are revised often (e.g., Spine Imaging revised effective Aug 15 2025). [Highmark guide](https://providers.highmark.com/content/dam/highmark/en/providerresourcecenter/pdfs/policies-programs/care-management-programs/radiology-and-cardiology-imaging-prior-auth-ref-guide.pdf), [AvMed eviCore 2025 revisions](https://www.avmed.org/media/p5njl0bc/outpatient-diagnostics-testing-for-certain-high-tech-radiology-services-such-as-mris-and-cat-scans.pdf), [Clover eviCore guidelines](https://www.cloverhealth.com/providers/evicore-guidelines). Rhode Island Medicaid moves radiology PA from eviCore to IPRO effective Oct 1 2026. [RI EOHHS](https://eohhs.ri.gov/ProvidersPartners/Billingamp%3BClaims/PriorAuthorization/RadiologyPriorAuthorizationProgramSummary.aspx)
- **Carelon Medical Benefits Management (formerly AIM):** radiology guidelines (CT, MRI, MRA, PET, and more) are **publicly posted, with an Archives section**, which is useful for citing the version in effect on the date of service. [Carelon guidelines](https://guidelines.carelonmedicalbenefitsmanagement.com/)
- **Implication:** the policy text is public, versioned and frequently revised, which is exactly the input a nightly policy-change watcher needs.

### CMS Appropriate Use Criteria (AUC) program: paused and rescinded
- The **CY2024 PFS final rule paused the AUC program and rescinded 42 CFR 414.94.** No restart date has been given. Since Jan 1 2024, AUC consultation information is no longer reported on claims. [CMS AUC page](https://www.cms.gov/medicare/quality/appropriate-use-criteria-program), [ACC](https://www.acc.org/latest-in-cardiology/articles/2023/12/14/15/16/cms-pauses-auc-program-for-advanced-diagnostic-imaging-rescinds-current-regulations), [MLN MM13485](https://www.hhs.gov/guidance/sites/default/files/hhs-guidance-documents/MM13485.pdf). I did not check whether anything changed after 2024 beyond the CMS page.
- **Implication:** there is no federal decision-support mandate for imaging orders in Medicare FFS. Payer and RBM policies are the effective gate.
- **WISeR** (CMS, Jan 2026, 6 states) adds AI-assisted PA to traditional Medicare for selected Part B services such as skin substitutes, nerve stimulators and knee arthroscopy. Imaging was not named. [Davis Wright Tremaine](https://www.dwt.com/insights/2025/07/cms-launches-wiser-model-to-curb-medicare-overuse), [Georgetown CHIR](https://medicare.chir.georgetown.edu/new-cms-wiser-model-revives-concerns-of-prior-authorization-and-artificial-intelligence/)

### CMS-0057-F (Interoperability and Prior Authorization Final Rule, Jan 2024)
Source: [CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f)
- **Who it covers:** MA organizations, Medicaid/CHIP FFS and managed care, and QHP issuers on the FFEs. Employer commercial plans and traditional Medicare are **not** listed. **Drugs are excluded.**
- **From Jan 1 2026:**
  - Decisions within 72 h (expedited) or 7 calendar days (standard). FFE QHPs are excluded from these timeframes.
  - **A specific reason for every PA denial, whatever the submission channel.**
  - Public PA metrics, first due Mar 31 2026.
- **From Jan 1 2027:**
  - **Prior Authorization API** that lists covered items and services and **"identifies documentation required for approval"**, and returns approve, deny (with reason) or request-more-info.
  - **Provider Access API** for claims, USCDI and PA data.
  - Payer-to-Payer API.
  - Payers may use FHIR-only or FHIR+X12 (enforcement discretion).
  - The MIPS Electronic Prior Authorization measure starts with CY2027.
- **Standards:** HL7 Da Vinci CRD, DTR and PAS are recommended (not yet required). [Da Vinci PAS](https://hl7.org/fhir/us/davinci-pas/en/background.html), [Da Vinci DTR](https://hl7.org/fhir/us/davinci-dtr/burden.html)
- **Does it help Denial Auditor?** Yes:
  1. Specific denial reasons make it easier to classify denials and map them to the criteria that failed.
  2. The 2027 PA API exposes "documentation required" in machine-readable form, which is a structured feed for our criteria checklist and the prevention mode.
  3. It doesn't cover commercial employer plans, so the PDF/web-policy parsing path is still needed.
  4. Small practices without a FHIR-capable EHR won't consume these APIs directly, so a tool that does it for them has room.

### Related: CMS-4201-F (CY2024 MA rule)
- From Jan 1 2024, MA plans may use internal coverage criteria only when Medicare criteria are "not fully established". Those criteria must be evidence-based and **publicly accessible** (42 CFR 422.101(b)(6)). Example from OIG: an MA plan requiring an x-ray before MRI when Medicare does not is exactly the kind of extra-Medicare criterion an appeal can attack. [CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/2024-Medicare-advantage-and-part-d-final-rule-cms-4201-f), [King & Spalding](https://kslaw.com/news-and-insights/new-medicare-advantage-regulations-add-provider-and-beneficiary-protections-against-plan-utilization-management-policies)

### Data source for date-of-service versioning (Medicare)
- The **CMS Coverage API** v1.5 (Jun 17 2025) has `/v1/data/lcd/revision-history` and `/v1/data/article/revision-history`, plus NCD `other-versions`. LCD and Article endpoints need a 1-hour license token from `/v1/metadata/license-agreement`, which means accepting the AMA/ADA/AHA license terms. [CMS Coverage API release notes](https://api.coverage.cms.gov/docs/release_notes). The MCD bulk downloads contain only current and recently retired versions. [MCD downloads](https://cms.gov/outreach-and-education/mln/educational-tools/mln901347-how-to-mcd/mcd/mcd/chapter_6_downloads)

---

## 4. Medicare Advantage denial evidence

- **HHS OIG, OEI-09-18-00260, April 27 2022:** "Some Medicare Advantage Organization Denials of Prior Authorization Requests Raise Concerns About Beneficiary Access to Medically Necessary Care."
  - **13%** of MA prior-auth denials met Medicare coverage rules, meaning they would likely have been approved under original Medicare.
  - **18%** of payment denials met Medicare and MA billing rules.
  - Sample: 250 PA denials and 250 payment denials from 15 of the largest MAOs, June 1–7 2019.
  - Causes: MAO clinical criteria not in Medicare rules (e.g., an **x-ray before advanced imaging**), and requests for unnecessary documentation.
  - Sources: [OIG report page](https://oig.hhs.gov/reports/all/2022/some-medicare-advantage-organization-denials-of-prior-authorization-requests-raise-concerns-about-beneficiary-access-to-medically-necessary-care/), [PDF](https://www.oversight.gov/sites/default/files/oig-reports/HHSOIG/OEI-09-18-00260.pdf)
- **KFF (Jan 28 2026), 2024 data:**
  - 52.8M MA prior-auth determinations.
  - **4.1M (7.7%) denied** fully or partly, up from 6.4% in 2023.
  - **Only 11.5% of denials appealed**, and **80.7% of appeals were fully or partly overturned**.
  - Source: [KFF](https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/)
- **The core economic argument:** roughly 4 in 5 appeals win, yet about 9 in 10 denials are never appealed. The bottleneck is the cost of assembling evidence, not how strong the case is.

---

## 5. Open-source and hackathon prior art

| Project | What it is | Provider-side, criterion-level? |
|---|---|---|
| **anthropics/healthcare**, `prior-auth` skill | Automates the *payer* review of PA requests. The repo includes a CMS Coverage MCP server. Licensed under Anthropic's terms of service, not OSI. [GitHub](https://github.com/anthropics/healthcare) | No, it is payer-side |
| **open-medica prior-authorization-review** skill | Analyzes a service against payer coverage policy, lists supporting chart documents, drafts the appeal and P2P points. Low adoption (about 15 stars). [skills.sh](https://www.skills.sh/open-medica/open-medical-skills/prior-authorization-review) | Partially. It is a prompt skill, not an evidence board, and has no citation verification. |
| **Heuristics / "aegis"** (Google Cloud Rapid Agent Hackathon, Jun 2026, Apache-2.0) | *Patient*-facing appeal drafter for Aetna, Cigna and UHC medical-necessity and PA denials. Uses Gemini 3 + ADK, an insurer playbook, a "self-check" step and an outcome simulator. [GitHub](https://github.com/dvy1987/aegis) | No. It is patient-side and no criterion-level verification was described. |
| **MediClear** (AMD Developer Hackathon, lablab.ai) | Four agents: classify denial, draft appeal, generate PA paperwork, track deadlines. Uses gpt-oss-20b. [lablab](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii/manvibuilds/mediclear-ai-agents-that-fight-denials) | Letter-level, not an evidence board |
| **PriorAI** | PA agent built on FHIR R4 / Da Vinci PAS, with initial and P2P appeal modes. Whether it was a hackathon entry is unverified. [demo](https://prior-ai.onrender.com/dashboard) | Unverified |
| dev.to: "Modeling prior authorization as a payer policy matching problem" | Blog post framing PA as policy matching. [dev.to](https://dev.to/kynth/modeling-prior-authorization-as-a-payer-policy-matching-problem-14o3) | Concept only |

No open-source or hackathon project was found that combines provider-side use, a criterion-by-criterion evidence board, exact-match citation verification, date-of-service policy versioning and policy-change watching.

---

## 6. Positioning

**The opening:** payers already run criterion-level, evidence-mapped AI review (Availity, Cohere, Anterior, eviCore). Provider-side incumbents answer with templated or GenAI *letters*, sold to health systems. Nobody publicly gives a 2–10 physician practice the same criterion-by-criterion view the payer uses, with every quote verified and pinned to the policy version in force on the date of service.

**The sharpest line:**

> **"Payers check your MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same: every policy criterion matched to the exact chart sentence, with the gap sent to the physician before the denial."**

Shorter variants:
- "The payer's checklist, on your side of the desk."
- "Not a letter generator: an evidence board. Every criterion, every quote verified, the policy version from the date of service."

Proof points for the pitch:
1. 80.7% of appeals win but only 11.5% are filed (KFF).
2. 13% of MA PA denials met Medicare rules, and the named example is an x-ray before advanced imaging (OIG OEI-09-18-00260).
3. 13 h/week on PA and 32% often or always denied (AMA 2025).
4. Only 14% of providers use AI for claims (Experian 2025).
5. Specific denial reasons have been required since 2026, and a "documentation required" API is due in 2027 (CMS-0057-F).

**Risks to address:**
- athenaOne (bundled AI denial and auth features for small practices) is the biggest platform threat.
- Epic's Penny is a threat for Community Connect practices.
- Commercial employer plans aren't covered by CMS-0057-F.
- The CMS LCD API requires accepting the AMA CPT license.
- eviCore guideline access can sit behind payer portals. Carelon's guidelines are public and archived.
