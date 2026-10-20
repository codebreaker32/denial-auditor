# Denial Auditor: data sources (policy + synthetic patients)

Research date: 2026-10-20. All HTTP results below come from live `curl` / fetches made that day (UA = desktop Chrome). "Verified" means I fetched the URL and saw the content myself. Not legal advice.

---

## TL;DR

| Source | Machine access | Versions / effective dates | Reuse terms | Verdict for a 10-day build |
|---|---|---|---|---|
| **CMS Medicare Coverage Database (LCD/NCD/Articles)** | Free JSON API + bulk ZIPs + plain HTML pages | Yes. Per-version `rev_eff_date`/`rev_end_date`, full revision history, retired versions still fetchable | US-government content. **The CPT codes inside are AMA-licensed** (click-through for "personal, non-commercial" use) | **Primary source. Best by far.** |
| **UnitedHealthcare** commercial radiology guidelines | Public PDFs, no gate, stable URLs per effective date | Yes. One PDF per effective date back to 10/21/2024, plus an upcoming 12/21/2026 version | "Proprietary Information of UnitedHealthcare. Copyright" | **Good second source** (commercial example). The file is huge, though: 14 MB / 3,513 pages |
| **Aetna CPB 0236** (MRI/CT of spine) | Plain HTML, full text returned to curl | Shows "Last Review" / "Next Review" only. No public prior versions found | "I accept" click-through modal (JS) with CPT licence; Aetna copyright | Good for a short quote + link |
| **eviCore** (Cigna, Oxford, many plans) | Public PDFs under `/sites/default/files/clinical-guidelines/...`; listing pages need JS + health-plan selection | Yes. Version and effective date sit in the filename; Current/Future/Archived tabs | **End User Agreement forbids copy/reproduce/upload/post/"public or commercial endeavor"** | Link only, don't ingest |
| **Carelon** (ex-AIM) | Full HTML + PDF, no login | Yes. Effective date, Doc ID, full history table, archives | **Click-through: "Use of the Guidelines by any external AI entity without the express written permission of Carelon is prohibited."** | **Do not feed to an LLM** |
| **ACR Appropriateness Criteria** | HTML readable without login | Variants/ratings | ACR legal page: copying is for ACR members' internal, noncommercial use only | Cite by name/link, don't quote at length |
| **Synthea** | Apache-2.0, Java, actively maintained | n/a | Apache-2.0 | Use it for structured FHIR. Generate the notes with Nemotron |

---

## 1. CMS Medicare Coverage Database (MCD)

### 1a. Access methods (all verified 2026-10-20)

- **Coverage API**: https://api.coverage.cms.gov/ (HTML docs page, 200). Per the docs page: "as of February 8, 2024, we have removed the need for an API key". Output is JSON only. Some endpoints need a **license token**, which "is obtained by accepting the AMA, ADA, and AHA license agreements via the License Agreement endpoint" and "is valid for one hour". Stated throttle is 10,000 req/s.
  - `GET https://api.coverage.cms.gov/v1/metadata/license-agreement/` returns 200 JSON with the full AMA CPT / ADA CDT / AHA UB-04 licence text and `data:[{"Token":"<uuid>"}]`. The text says: *"By visiting the "/v1/metadata/license-agreement" endpoint, you hereby acknowledge that you have read, understood, and agree to all terms…"* **Calling this endpoint counts as accepting the licence.**
  - `GET /v1/reports/local-coverage-final-lcds/` returns **no token needed**. It is 445 KB of JSON listing 969 LCDs with `document_display_id`, `document_version`, `title`, `contractor_name_type`, `effective_date`, `retirement_date`, `note` ("Retired") and `url`.
  - `GET /v1/reports/national-coverage-ncd/` needs no token.
  - `GET /v1/data/lcd/?lcdid=34220&ver=40` without a token returns **401** (`"UNAUTHORIZED – the request did not include a valid authentication token"`). With `Authorization: Bearer <token>` it returns 200 (27.7 KB). Fields: `orig_det_eff_date`, `rev_eff_date`, `rev_end_date`, `indication` (HTML), `doc_reqs`, `keywords`, `status`, `date_retired`, and `meta.children` links to `revision-history`, `related-documents`, `contractor`, `hcpc-code`, `urls`, etc.
  - **Older versions are fetchable**: `ver=37` of L34220 returns `rev_eff_date 08/18/2022, rev_end_date 10/22/2025`. The retired LCD L37281 v23 returns `rev_eff_date 08/18/2022, rev_end_date 10/23/2025, status R`. `ver=35` returns an empty `data` array (not every version number exists). **This is exactly what you need for "the version in effect on the date of service".**
  - Article endpoints: `/v1/data/article/?articleid=57206`, plus `/hcpc-code`, `/icd10-covered`, `/icd10-noncovered`, `/revision-history`.
  - `/v1/metadata/update-period/` returns weekly update periods (latest 2026-10-05 to 2026-10-12).
- **Bulk downloads page**: https://www.cms.gov/medicare-coverage-database/downloads/downloads.aspx (200, HTML). It shows the same licence click-through ("To access this content, you must click below…") and says *"Access files (.MDB) are the recommended format. CSV files contain raw data and embedded HTML"*. The ZIP links themselves download directly with no gate (HEAD, all `application/zip`, last-modified 15 Oct 2026):
  - https://downloads.cms.gov/medicare-coverage-database/downloads/exports/current_lcd.zip (34.2 MB)
  - https://downloads.cms.gov/medicare-coverage-database/downloads/exports/all_lcd.zip (36.4 MB, includes history)
  - https://downloads.cms.gov/medicare-coverage-database/downloads/exports/current_article.zip (41.6 MB)
  - https://downloads.cms.gov/medicare-coverage-database/downloads/exports/ncd.zip (1.3 MB)
  - https://downloads.cms.gov/medicare-coverage-database/downloads/exports/all_data.zip (158.6 MB)
- **HTML pages**: e.g. https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=34220&ver=40 returns 200 (213 KB). The AMA/ADA/AHA "I Accept / I Do Not Accept" modal is in the page, but **the LCD body text is already in the raw HTML** (grep for "four weeks", "Saddle anesthesia" etc. finds it). So a Tavily `extract` on this URL should get the text, though I did **not** test this to save Tavily credits. A wrong `ver` redirects to `search.aspx?error=Invalid+LCD+Version` (seen with `lcdid=37133`). Always take the `url` from the API report.

### 1b. Concrete MRI/CT documents (IDs from the live API report)

| ID | Title | Contractor | Version / effective | URL |
|---|---|---|---|---|
| **L34220** | Lumbar MRI | Noridian (JE+JF since consolidation) | v40, eff **10/23/2025**, not retired. Original eff 10/01/2015 | https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=34220&ver=40 |
| **A57206** | Billing and Coding: Lumbar MRI (related to L34220) | Noridian | v33, article eff **10/01/2026** | https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=57206 |
| L37281 | Lumbar MRI (retired; the other Noridian jurisdiction's copy) | Noridian | v23, 08/18/2022 → retired 10/23/2025 | https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=37281&ver=23 |
| **L37373** | MRI and CT Scans of the Head and Neck | Noridian | v41, eff 10/23/2025 | https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=37373&ver=41 |
| L34425 | Magnetic Resonance Imaging of the Head and Neck | Palmetto GBA | v43, eff 03/27/2025 | https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=34425&ver=43 |
| L34417 | CT of the Head | Palmetto GBA | v57, eff 08/17/2023 | https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=34417&ver=57 |
| L34415 | CT of the Abdomen and Pelvis | Palmetto GBA | v58, eff 08/28/2022 | https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=34415&ver=58 |
| NCD 220.2 | Magnetic Resonance Imaging | national | v6 | API: `/v1/data/ncd?ncdid=177&ncdver=6` |
| NCD 220.1 | Computed Tomography | national | v2 | API: `/v1/data/ncd?ncdid=176&ncdver=2` |

L34220 revision history, from `/v1/data/lcd/revision-history?lcdid=34220&ver=40`: 10 entries (10/01/2015 … 10/23/2025). The latest says *"This update is to consolidate JE and JF to have one unified document and policy number… considered non-substantive"*. Related docs: A57206 (billing & coding), A56018 (Response to Comments), A56017.

A57206 codes (from `/hcpc-code`): 72148, 72149, 72158, A9585, Q9953. `/icd10-covered` lists **3,378** covered ICD-10 codes, including M54.50, M54.51, M54.59, M54.16, M54.17, M54.41, M54.42, M48.061, M48.062, R20.2, R29.2, C79.51 and G83.4. So a Medicare lumbar MRI denial for plain low back pain is usually a **medical-necessity/documentation** denial, not a diagnosis-code mismatch. That makes it the right shape for an audit tool.

### 1c. Licence and terms
- The CPT licence text served by the API (verbatim excerpt): *"You are authorized to use CPT only as contained herein for your personal use only. Personal use means non-commercial uses for display on personal computers or other devices. Any use not authorized herein is prohibited, including … creating any modified or derivative work of CPT, or making any commercial use of CPT."* (https://api.coverage.cms.gov/v1/metadata/license-agreement/; same text at https://www.cms.gov/license/ama, which returns 200)
- The ADA CDT section explicitly prohibits *"distributing to commercial third-parties outputs in which the CDT is embedded … (e.g. Artificial Intelligence outputs)"*. Dental codes don't matter for imaging, but this shows the licensors are thinking about AI outputs.
- The LCD narrative (indications, red flags, etc.) is authored by Medicare contractors for CMS and carries no separate copyright notice in the API payload. The licence restrictions attach to the **CPT descriptors** (e.g. the long descriptors returned by `/hcpc-code`), not to the narrative.

---

## 2. eviCore (Evernorth / Cigna)

- Landing page https://www.evicore.com/provider/clinical-guidelines (200, 85 KB). Solution page https://www.evicore.com/provider/clinical-guidelines-details?solution=cardiovascular%20and%20radiology (200, 91 KB). **The guideline list is not in the HTML.** It is rendered by JS after you pick a health plan (form field `hPlan`; the generic plan is "EviCore by Evernorth", `data-health-plan-tid=566`). The page has Current / Future / Archived tabs.
- The JS bundle shows two gates: an **End User Agreement modal** (`/provider/clinical-guidelines-details/end-user-agreement-modal`, remembered by the cookie `clinical_guidelines_end_user_agreement`) and a **per-download agreement modal** (`/download-agreement-modal?mediaUrl=…`). The PDFs themselves download without any cookie.
- Verbatim EUA text (fetched from the modal endpoint): *"EviCore's Clinical Review Criteria ("CRC") and related content is made available for the limited uses of: reference; and individual use, only limited to facilitating the determination of medically necessary and appropriate clinical treatment by clinicians for specific delegated patients under their care… you may not modify, copy, reproduce, republish, upload, post, transmit, hyperlink to or from, or distribute in any way the CRC, nor may you … use the CRC in commerce … or for any public or commercial endeavor without our prior and express written consent."* Footer: "Copyright 2026 EviCore healthcare". Terms of use: https://www.evicore.com/terms-of-use
- **Cigna** sends MRI/CT policy to eviCore. The Cigna A–Z list (https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/medical_a-z.html) links "Magnetic Resonance Imaging (MRI)" and "Computed Tomography (CT)" to https://www.evicore.com/cigna. That page (200, server-rendered) lists direct PDFs, for example:
  - Spine Imaging V2.0.2026, eff 09/01/2026 (PDF, 627 KB, 115 pages): https://www.evicore.com/sites/default/files/clinical-guidelines/2026-05/Cigna_Spine%20Imaging_V2.0.2026_Eff09.01.2026_Pub05.11.2026.pdf
  - **Upcoming** Spine Imaging V3.0.2026, eff 11/05/2026 (PDF, 702 KB): https://www.evicore.com/sites/default/files/clinical-guidelines/2026-07/Cigna_Spine%20Imaging%20Guidelines_V3.0.2026_Eff11.05.2026_pub07.15.2026.pdf
  - Head Imaging V2.0.2026, eff 09/01/2026: https://www.evicore.com/sites/default/files/clinical-guidelines/2026-05/Cigna_Head%20Imaging_V2.0.2026_Eff09.01.2026_Pub05.11.2026.pdf
  - **Version and effective date are encoded in the filename** (`V<x>.<year>_Eff<mm.dd.yyyy>_Pub<mm.dd.yyyy>`). Section codes such as `SP.LB.0005.1.A v2.0.2026` appear inline.
- Old UHC/Oxford eviCore PDF still live (200, 13.5 MB): https://www.evicore.com/sites/default/files/clinical-guidelines/2024-08/UHC_Oxford_CardRad%20GLs_V4.0.2024_eff10.21.2024_pub08.09.2024.pdf
- Cigna's own coverage policy index (static, 200): https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/index.html. Site-of-care policy 0550 is a Cigna PDF: https://static.cigna.com/assets/chcp/pdf/coveragePolicies/medical/mm_0550_coveragepositioncriteria_soc_htr.pdf

## 3. Carelon Medical Benefits Management (formerly AIM)

- Index: https://guidelines.carelonmedicalbenefitsmanagement.com/current-radiology-guidelines/ (200, 264 KB, server-rendered WordPress). Every guideline has a dated slug, e.g. **Imaging of the Spine 2026-09-19**: https://guidelines.carelonmedicalbenefitsmanagement.com/imaging-of-the-spine-2026-09-19/ (200, 371 KB). The **full guideline text is in the HTML** (~84 K chars), with the header *"Status: Revised Effective Date: 09/19/2026 Doc ID: RBM05-0926.1 Last Review Date: 01/29/2026"* and a full **History** table (status / review date / effective date / action, back to 2021).
- PDF: https://guidelines.carelonmedicalbenefitsmanagement.com/wp-content/uploads/2026/06/PDF-Imaging-of-the-Spine-2026-09-19.pdf (`application/pdf`, 445 KB). The "Link to PDF" page is an HTML PDF-embedder wrapper.
- Archives: https://guidelines.carelonmedicalbenefitsmanagement.com/radiology-archives/ has dated ranges, e.g. https://guidelines.carelonmedicalbenefitsmanagement.com/archived-imaging-of-the-spine-2025-11-15-to-2026-09-19/. **This is the best version history of any commercial source.**
- **Terms (blocking)**: the page loads a "wp-terms-popup" click-through (popup id 1546, via `admin-ajax.php` action `wptp_ajaxhandler_popup`). Verbatim: *"…you are expressly prohibited from selling, assigning, leasing, licensing, reproducing, or distributing the Guidelines and Pathways unless authorized in writing by Carelon. **Use of the Guidelines by any external AI entity without the express written permission of Carelon is prohibited.** … They should not be accessed via bookmarks or saved links…"*
- For contrast only (not for ingestion), the adult low back pain criterion as shown: *"Advanced imaging is considered medically necessary in EITHER of the following scenarios: Neurologic exam findings suggesting lumbar nerve root or cord compression… Pain or radiculopathy (including chronic neurogenic claudication) following at least 6 weeks of conservative management (imaging no more than annually)…"*

## 4. UnitedHealthcare, Aetna, Cigna (commercial)

### UnitedHealthcare (public, no gate, strongly versioned)
- Policy list: https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html (200). Relevant policies:
  - **MP.13.20 "MRI and CT Scan – Site of Service"**, eff 09/01/2026 (PDF, 386 KB, 8 pages): https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/mri-ct-scan-site-of-service.pdf. It has a "Policy History/Revision Information" table ("Archived previous policy version MP.13.19"). This policy covers site of service, not clinical indication.
  - Oxford RADIOLOGY 037.42 (eviCore arrangement), eff 09/01/2026: https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/radiology-procedures-evicore-ohp.pdf
  - Monthly update bulletins plus a bulletin archive PDF: https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/mpub-archive-uhc.pdf
- **Clinical criteria** live on https://www.uhcprovider.com/en/prior-auth-advance-notification/radiology-prior-authorization.html (200). It has **one PDF per effective date** for Commercial/Exchange, Medicare Advantage, Community Plan and Oxford, e.g.:
  - COMM/Exchange V6.0.2026 eff **10/01/2026** (14.0 MB, 3,513 pages): https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/r-c/COMM-Exchange-Rad-Card-Guidelines-10-2026.pdf
  - Upcoming eff 12/21/2026: https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/r-c/COMM-Exchange-Rad-Card-Guidelines-Dec-2026.pdf
  - Older versions (12/01/2025, 16.4 MB): https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/radiology/COMM-Exchange-Rad-Card-Guidelines-Dec-2025.pdf … back to 10/21/2024
  - Ohio Medicaid per-body-part PDFs, e.g. Adult Spine 09-2026: https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/radiology/Ohio-Radiology/2026/UN-CSRAD014OH-F-Adult-Spine-09-2026.pdf
  - Footer on every page: "Proprietary Information of UnitedHealthcare. Copyright ©2026 United HealthCare Services, Inc." The **SP-5.1 text is word-for-word identical to the Cigna/eviCore PDF**, including the section code `SP.LB.0005.1.A v2.0.2026`, so this is eviCore-authored content under a UHC label.
  - Practical problem: 14 MB / 3,513 pages is too large for a single Tavily extract. Slice it server-side (PyMuPDF, page ranges for the "Spine" TOC section).

### Aetna
- CPB 0236 "MRI and CT of the Spine": https://www.aetna.com/cpb/medical/data/200_299/0236.html (200, 177 KB HTML; full policy text comes back to curl). It shows *"Last Review 04/09/2026 … Effective: 05/06/1998 Next Review: 02/25/2027"*. The "Review History" tab is empty in the static HTML, and I found **no public prior versions**. Effective-date-on-DOS can't be proven for older dates; store snapshots yourself.
- Click-through: the CPB landing page https://www.aetna.com/health-care-professionals/clinical-policy-bulletins/medical-clinical-policy-bulletins.html has a JS modal "Medical clinical policy bulletins: By clicking on "I accept"…" that includes the AMA CPT licence ("…solely for your own personal use…"). The direct CPB URL is not blocked at the HTTP level.
- Relevant criterion (verbatim): *"Persistent back or neck pain with radiculopathy as evidenced by pain plus objective findings of motor or reflex changes in the specific nerve root distribution, and no improvement after 6 weeks of conservative therapy"*. Footnote: *"Conservative therapy = moderate activity, analgesics, non-steroidal anti-inflammatory drugs, muscle relaxants."*

### Cigna
- Uses eviCore for MRI/CT (see §2). eviCore's EUA applies.

## 5. ACR Appropriateness Criteria
- Low Back Pain: https://acsearch.acr.org/docs/69483/Narrative (200, 385 KB HTML, no login). It has variants and ratings, e.g. *"Variant 1: Acute low back pain with or without radiculopathy. No red flags. No prior management. Initial imaging."* where MRI lumbar spine without IV contrast is "Usually Not Appropriate". Topic list: https://acsearch.acr.org/list. Lit search: https://acsearch.acr.org/docs/69483/LitSearch/
- Terms: https://www.acr.org/Legal (200): *"The materials are for the internal, noncommercial use of ACR members only… The ACR strictly prohibits reproduction for commercial purposes or multiple distributions of any copyrighted materials on this site, by any means, electronic or otherwise."* The search-result "Terms-and-Conditions" URL for AC returns **404** today.
- What a tool can do: name the variant and rating with a link, as a short factual citation. Don't bulk-ingest or reproduce the tables.

## 6. Synthea
- Repo: https://github.com/synthetichealth/synthea. **Apache-2.0** (GitHub API `license.spdx_id`), last push 2026-10-19, about 3.4k stars.
- **Low back pain**: there is no dedicated LBP module. "Chronic low back pain (finding)" (SNOMED 278860009) and "Transformed migraine" come from `prescribing_opioids_for_chronic_pain_and_treatment_of_oud.json` (https://github.com/synthetichealth/synthea/blob/master/src/main/resources/modules/prescribing_opioids_for_chronic_pain_and_treatment_of_oud.json), where about 9% of the general adult population branch gets chronic LBP. No headache-workup module, and **no lumbar-MRI-ordering module**. The engine supports an `ImagingStudy` state, used in e.g. `injuries.json`, `vhd_*.json` and `eye/ophthalmic_tomography.json`, so a custom module can be written. Module Builder GUI: https://synthetichealth.github.io/module-builder/ (200). State docs: https://github.com/synthetichealth/synthea/wiki/Generic-Module-Framework:-States
- **Notes**: `synthea.properties` has `exporter.clinical_note.export = false` (default). The note template `src/main/resources/templates/notes/note.ftl` is a FreeMarker skeleton (Chief Complaint / HPI "X is a 54 year-old … Patient has a history of …" / Social / Meds / Plan). It reads as robotic and has no exam findings (SLR, reflexes, motor grades) or therapy duration, which are exactly the facts the audit needs.
- **Suggested approach**:
  1. Write a tiny custom Synthea module, or skip Synthea for the demo cohort and emit FHIR R4 directly from a Python scenario spec. Each scenario carries a **ground-truth criteria vector**, e.g. `{red_flag: none, conservative_weeks: 2, pt_sessions: 0, nsaid: yes, re_eval: no, surgery_considered: no}`.
  2. Have **Nemotron (Token Factory)** render 2–4 encounter notes (initial visit, PT note, follow-up, MRI order) from that vector with a strict template (HPI, exam with MMT 0–5 / reflex 0–4+ grades, plan). Then run a second Nemotron pass that extracts the facts back, and assert that they match the vector. This gives you labelled synthetic evals and doubles as a demo of extraction accuracy.
  3. Use Synthea output for realistic demographics, meds and conditions (FHIR `Patient`, `Condition`, `MedicationRequest`), and attach the generated notes as FHIR `DocumentReference`.
  4. Mark every artifact "SYNTHETIC – NOT A REAL PATIENT".

## 7. Recommendation

**Sources for a 10-day build (ranked):**
1. **CMS Coverage API** (LCD + billing article). It's free, structured, has per-version effective/end dates and retired versions, and the narrative isn't AMA-encumbered. It is the only source where "version in effect on DOS" is a database lookup.
2. **UnitedHealthcare radiology guideline PDFs** (public, one file per effective date, no click-through). This is the commercial counterpart: 6 weeks vs Medicare's 4 weeks. Quote short excerpts with attribution and slice by page.
3. **Aetna CPB 0236** (HTML) as a third payer for short quotes. Snapshot it yourself for versioning.

Use Tavily at runtime to **locate** the policy. For example, `search(query="Noridian LCD lumbar MRI", include_domains=["cms.gov"])`, then `extract` on the cms.gov LCD URL or the uhcprovider.com PDF (with page slicing). Then resolve the authoritative version via the CMS API using DOS. **Avoid ingesting eviCore/Carelon content** (contractual bans; Carelon explicitly bans AI use). Link to them instead. Tavily behaviour on these exact URLs is untested (no credits spent).

**Demo scenario: Medicare lumbar MRI denial (Noridian L34220)**
- Synthetic patient: 67 y/o in a Noridian JE/JF state, ICD-10 M54.50 (covered in A57206), CPT 72148, DOS **2026-08-14**. Version in effect: **L34220 v40, rev eff 10/23/2025, no end date** (API). A second patient with DOS **2025-06-02** shows version selection: the lookup resolves to the pre-consolidation version (L34220 v37 08/18/2022–10/22/2025, or the retired L37281 v23 depending on jurisdiction).
- Denial reason (synthetic): "not reasonable and necessary – documentation does not support". The notes show LBP for 2 weeks, ibuprofen only, no neuro exam documented.
- Checkable criteria, **verbatim from L34220 v40** (`/v1/data/lcd/?lcdid=34220&ver=40`, eff 10/23/2025; page https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=34220&ver=40):
  1. *"Lumbar MRI may be indicated for a patient with a "red-flag" condition, such as a suspected tumor, infection, herniated intervertebral disc with nerve compression, or a major neurological problem."*
  2. Red-flag list: *"Major trauma; Minor trauma in a potentially osteoporotic patient; History of cancer; Fever; Chills; Unexplained weight loss; Recent bacterial infection; IV drug abuse; Immune suppression; Pain that worsens when supine or at night; Saddle anesthesia; Recent onset of bladder dysfunction; Clinically significant or progressive neurologic deficit in the lower extremity; Unexpected laxity of the anal sphincter; Perianal or perineal sensory loss, Clinically significant motor weakness, or Other nerve root compromise"*
  3. *"…spinal imaging tests are not generally necessary during the first month of symptoms except when a "red flag" … is noted on the medical history and physical examination. For a "non-red flag" condition, the MRI may be appropriate after 1 month of symptoms."*
  4. *"…(i.e. no "red flags"), MRI will be covered only if the patient has not responded to a reasonable trial of conservative management lasting at least four weeks."*
  5. *"A lumbar MRI used to evaluate uncomplicated degenerative disc disease or herniated nucleus pulposus is not considered medically necessary when a surgical intervention or other aggressive treatment (e.g. intervertebral joint injection) is not under consideration."*
  6. *"When the findings will not affect the treatment choices, the test is not reasonable or necessary."*
  7. *"A lumbar MRI that is a duplication of other imaging studies (such as a spinal CT scan) may be unreasonable or unnecessary."*
- Demo twist: run the same synthetic chart against UHC SP-5.1 (V6.0.2026, eff 10/01/2026). That policy requires an *"in-person clinical evaluation"*, *"Failure of a 6-week trial of provider-directed treatment"* and *"Clinical re-evaluation after treatment period"*. A patient at 5 weeks passes Medicare (≥4 weeks) but fails UHC (6 weeks). This shows why citing the right payer and version matters.

## 8. Legal: quoting policy and codes in an appeal tool

- **CPT** (AMA): *"CPT is copyrighted by the AMA and as such must be licensed to be used in electronic products… Any entity using CPT content anywhere worldwide must have a license…"*. Licence-required examples include *"Use of CPT content to develop, test, maintain and service products that use or rely on CPT"* (https://www.ama-assn.org/practice-management/cpt-licensing, 200). The AMA also notes newly added AI-specific licence terms. The CMS/MCD click-through only grants **personal, non-commercial** use.
- **ICD-10-CM**: NCHS/CDC provide it at no cost (https://www.cdc.gov/nchs/icd/icd-10-cm/index.html returned **403** to curl, so I only saw it via search snippet). It is a US-government modification of the WHO ICD-10 and is generally treated as public domain. Low risk.
- **Payer criteria**: UHC/Aetna are copyrighted ("Proprietary Information of UnitedHealthcare", "Copyright Aetna Inc."). eviCore and Carelon add **contractual** bans (eviCore: no copy/reproduce/upload/post; Carelon: no "external AI entity" use). Quoting a short criterion in an appeal letter about a specific patient is the normal use case these documents exist for, but building a corpus or a public demo on them is not.
- **Safe pattern for the hackathon**:
  1. Build the criteria engine on **CMS LCD narrative** (government work).
  2. Show CPT as **bare 5-digit codes only**. Don't display AMA long descriptors (strip them from `/hcpc-code` output) or use your own plain-English labels. Add the AMA attribution line ("CPT © 2025 American Medical Association. All rights reserved.") wherever codes appear, and state that a production version needs an AMA licence.
  3. For commercial payers, fetch at runtime (Tavily) and show **short, attributed quotes with a link plus the effective date**. Don't redistribute full documents, store bulk copies in the repo, or train on them.
  4. Never fetch or feed Carelon or eviCore text to Nemotron. Link out and let the user read it.
  5. Accepting the CMS API licence-token endpoint counts as agreeing to the AMA/ADA/AHA terms. Document this in the README, and keep it a personal, non-commercial hackathon demo.
  6. Synthetic patients only (Synthea is Apache-2.0), clearly labelled.
