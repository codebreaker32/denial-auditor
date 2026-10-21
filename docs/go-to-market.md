# Denial Auditor: go-to-market plan for US clinics

**Timing: all of this starts after the hackathon (after Oct 30, 2026).** None of it changes the hackathon build. The only thing used before then is the "free denial audit" idea, as a closing line in the video.

**Hard line:** the hackathon build uses synthetic data only and **must not be used with real US patient data** until Phase 0 is complete.

Sources for the numbers are in [research/competitors.md](research/competitors.md). Items marked *unverified* need checking before they're used publicly.

---

## Phase 0: Make it legal to handle real patient data (before any pilot)

| Requirement | Why | Status / next step |
|---|---|---|
| HIPAA **business associate agreements (BAAs)** with every vendor that touches patient data | Clinics can't share patient data without them | Token Factory: research says a BAA is available for chat/completions with Zero Data Retention on, so **confirm with Nebius**. AWS signs BAAs, but **check whether Lightsail is on AWS's HIPAA-eligible services list**; if not, move hosting to an eligible service |
| **No patient data in Tavily queries** | No Tavily BAA is known | The design already searches only payer + procedure code + state. Make it a tested rule (a unit test that fails if a query contains case fields) |
| **Commercial AMA CPT licence** | The CMS Coverage API licence accepted for the hackathon is personal, non-commercial use only | Contact the AMA about commercial licensing before charging anyone |
| **Legal entity, contracts, privacy policy, cyber insurance** | Clinics and billing companies will ask for them | Not started. A US entity makes contracts and BAAs easier for a team outside the US |
| **Security basics:** encryption at rest and in transit, access logs, data retention and deletion policy, security questionnaire answers | Standard procurement questions | Not started |
| **Payer content terms** | eviCore and Carelon forbid reuse or AI use; UHC and Aetna content is copyrighted | Keep the hackathon rule: link to them, short attributed quotes only, never store or redistribute full documents. Get legal advice before scaling |

## Phase 1: Narrow first customer

1. **Billing companies serving small practices (primary target).** One customer brings many practices' denials, they're paid to recover money, and they feel the time cost directly.
2. **Independent orthopedic, spine, neurology and physical-therapy practices.** They order many lumbar MRIs, which matches the demo case and the L34220 policy.
3. **Avoid at first:** health systems on Epic, and practices on athenaOne (it bundles AI denial and prior-auth features for its own customers).

## Phase 2: The offer — a free "denial audit"

1. The practice or billing company shares its **last 90 days of MRI/CT denials** under a BAA.
2. We return a report: how many denials, the dollars at stake, how many look winnable under the policy in effect on each date of service, the evidence for each, and drafted appeals ready for human review.
3. The report shows money they were leaving behind, and it becomes the case for a paid pilot.

Why it works: in Medicare Advantage, **80.7% of appeals are fully or partly overturned, yet only 11.5% of denials are appealed** (KFF, 2024 data). The audit shows that gap in the customer's own numbers.

## Phase 3: Pricing (hypotheses to test, not decisions)

| Model | Pros | Cons |
|---|---|---|
| Per case worked | Simple, predictable | Clinic pays even when an appeal loses |
| Share of money recovered | Zero risk for the clinic; common in billing services | Slower revenue; needs outcome tracking |
| Per practice per month | Predictable recurring revenue | Harder to sell before value is proven |

Reference point: Rivet, the closest small-practice workflow tool, lists "starting at $6,000/yr" on a third-party site (*unverified*). Test 2–3 models in the first pilots before fixing a price.

## Phase 4: Channels

- **Hackathon assets:** demo video, live demo and write-up as outreach material.
- **Professional communities:** MGMA (medical practice managers), AAPC (coders and billers), billing-company groups on LinkedIn and forums.
- **Direct outreach** to billing companies, offering the free audit.
- **Content:** short posts walking through a synthetic denial and the exact policy line that overturns it (e.g. the HHS OIG finding that some MA plans required an X-ray before advanced imaging when Medicare didn't).
- **A US advisor** (practice manager or billing-company owner) to open doors and check the workflow.

## Phase 5: Product gaps between the demo and a sellable product

- **Intake:** PDF and CSV upload at first; EHR, clearinghouse and remittance (835/ERA) connections later.
- **Coverage:** more payers beyond Medicare and Aetna, and more procedures beyond MRI/CT.
- **Teams:** user accounts, roles, audit trail, a shared work queue for several billers.
- **Outcome tracking:** record whether each appeal won. That data becomes the main proof of value and improves triage.
- **Regulatory tailwind:** from Jan 2027, CMS-0057-F requires covered payers (MA, Medicaid/CHIP, federal-exchange plans) to offer a Prior Authorization API that lists the documentation required. Plan to consume it for the prevention mode.

## Rough sequence after the hackathon

| When | Milestone |
|---|---|
| Month 1 | Confirm BAAs (Nebius, AWS), resolve the AMA licence question, HIPAA-ready hosting; 10 discovery calls with billing companies |
| Month 2 | 2–3 free denial audits on BAA-covered or de-identified data |
| Month 3 | First paid pilot; measure win rate, dollars recovered and hours saved |

## Risks

- **athenaOne** and **Epic** add similar features for their own customers.
- Payers change policy formats or restrict access.
- Selling to US healthcare is slow and trust-driven, which is harder for a team outside the US without a US entity or advisor.
- Legal exposure if the tool is presented as legal or medical advice. Keep it "decision support for billing staff", with a human always reviewing and sending.
