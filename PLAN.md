# DMARD Prescribing & Monitoring App: Project Plan (draft v0.1)

## 1. Purpose

A fast, mobile-friendly reference for clinicians across Humber & North Yorkshire
and West Yorkshire on prescribing and monitoring DMARDs. It:

- follows **national BSR guidance** (this replaces the 2019 regional guideline);
- **fills the gaps** BSR doesn't cover yet (e.g. newer JAK/TYK2 inhibitors);
- **links to the local shared care agreements** (APC documents) for each ICB;
- adds practical topics: steroids, peri-operative management, vaccinations,
  pregnancy and breastfeeding, and key evidence.

## 1a. Source material received (2024.zip)

- **Yorkshire Rheumatology Regional DMARD Guidelines, 8th ed. (revised
  March 2024; v2 and v3)**. Contents: corticosteroids; csDMARDs; bDMARD
  tables and drug pages; tsDMARDs (apremilast, baricitinib, tofacitinib,
  and in v3 also filgotinib and upadacitinib, which the contents page
  doesn't list yet); vaccination and travel; surgery; pregnancy. Each drug
  already uses a consistent table: *Dose · Baseline tests · Routine
  monitoring · Indications for stopping…*. **That table maps directly onto
  the app's drug-page data model**, so the regional guideline is the
  starting content. Each item gets checked against BSR 2025.
- **RDTC shared care protocols**: azathioprine/mercaptopurine (v1.1, July
  2024) and hydroxychloroquine (HNY ICB draft). The app should **link** to
  the live APC versions, not copy them, so it never shows an out-of-date SCP.
- Likely removals or archiving: injectable gold and penicillamine (rarely used now).
- Gaps to add: deucravacitinib, bimekizumab, guselkumab and risankizumab
  pages, an updated JAK safety section (MHRA 2023), and Shingrix eligibility.

## 2. Users

| User | Main need |
|---|---|
| GPs and practice pharmacists | Shared care monitoring: "the result is X, what do I do?" |
| Rheumatology nurses and specialist pharmacists | Screening checklists, monitoring schedules |
| Rheumatology doctors and trainees | Quick drug facts, peri-op, pregnancy, vaccines |
| Surgeons and anaesthetists | Peri-operative hold/restart guidance |
| (Later, optional) Patients | Plain-English drug leaflets, blood test reminders |

## 3. Content map

### Drugs (one standard page per drug)
Every drug page has the same sections: indication · pre-treatment screening ·
dosing · monitoring schedule · **abnormal-result actions (traffic light)** ·
key interactions · peri-op · pregnancy/breastfeeding · vaccines ·
shared care link (per ICB) · source and review date.

- **csDMARDs** (BSR 2025): methotrexate, sulfasalazine, hydroxychloroquine,
  leflunomide, azathioprine, mycophenolate, ciclosporin, tacrolimus, others in scope
- **bDMARDs** (BSR biologic safety guideline; **update expected 2026**):
  anti-TNF, IL-6, IL-17, IL-23, IL-12/23, abatacept, rituximab, IL-1
- **tsDMARDs and newer agents (local content, gap-fill)**: tofacitinib,
  baricitinib, upadacitinib, filgotinib (JAK); deucravacitinib (TYK2);
  apremilast (PDE4). Include MHRA JAK safety advice (age ≥65, smokers,
  CV and malignancy risk, VTE).

### Topic pages
- Glucocorticoids: bone protection, tapering, sick-day rules, adrenal insufficiency
- Peri-operative management (when to hold and restart each drug)
- Vaccinations: live vaccine rules, Shingrix, pneumococcal, flu, COVID, RSV
- Pregnancy, breastfeeding and paternal exposure (BSR pregnancy guideline)
- Infection screening: TB, HBV, HCV, HIV, VZV
- Shared care hub: links to HNY APC and West Yorkshire APC documents
- Evidence: key trials per drug class (selected **independently**, see §5)

## 4. Recommended technical approach

**A Progressive Web App (PWA)**: a website that installs on a phone like an app.

- Works on iPhone, Android and NHS desktops from a single codebase
- No app store review or fees, and updates go live as soon as they are published
- Works offline once installed (useful on wards with poor signal)
- Can be wrapped for the App Store or Google Play later if needed

**Content as structured files** (Markdown/JSON) in this git repository:
- every change is versioned, attributable and reviewable (audit trail);
- each page shows *source guideline · last reviewed · next review date*;
- clinicians edit text, not code.

**No patient data and no login** for the MVP. This keeps information governance
simple: no DPIA-heavy processing and no hosting of personal data.

**Alternative to consider:** existing NHS guideline platforms (e.g. MicroGuide,
Eolas) already used by many trusts. These are cheaper to run but less flexible.
Worth a quick comparison before committing.

## 5. Governance: sort this out before building

1. **Pharma funding (Alfasigma).** Alfasigma markets filgotinib (Jyseleca), a
   JAK inhibitor, which is one of the drug classes this app adds content on.
   - Use a written agreement under the ABPI Code of Practice (as a Medical &
     Educational Goods/Service or a sponsorship): **no editorial control** by
     the funder, sponsorship clearly declared in the app, no product promotion.
   - The "key studies" section must be selected by the clinical editorial
     group, not the sponsor.
   - Funding should ideally go via the trust or ICB rather than to individuals.
2. **Clinical ownership.** Name a clinical lead and an editorial board
   (rheumatologist, specialist pharmacist, specialist nurse, GP rep). Get
   sign-off from both APCs/medicines optimisation teams.
3. **Clinical safety (DCB0129/DCB0160).** Needed for NHS health IT. Keep a
   hazard log and appoint a Clinical Safety Officer.
4. **Medical device regulation (MHRA).** A static reference app is generally
   *not* a medical device. Anything that **calculates or interprets
   patient-specific values** (e.g. "enter ALT, get an action", dose calculators)
   can make it Software as a Medical Device. **MVP: static traffic-light tables
   only, with no calculators.**
5. **Copyright.** BSR guidelines are published by OUP. **Summarise and link**
   rather than reproduce text or tables verbatim, or seek BSR permission.
   Better still, invite BSR to endorse the app.
6. **Review cycle.** Every page has a review date. Watch for the BSR biologic
   update in 2026 and for MHRA Drug Safety Updates.

## 6. Phased delivery

| Phase | Deliverable |
|---|---|
| **0. Set-up** | Funding agreement, editorial board, scope sign-off, app name |
| **1. Content audit** | Map the 2019 regional guideline against BSR 2025 and the biologic guideline; list what is kept, replaced and new |
| **2. MVP** | PWA with csDMARD pages, shared care links, search, offline. Clinical review |
| **3. Expand** | bDMARD + tsDMARD pages, steroids, peri-op, vaccines, pregnancy, evidence |
| **4. Pilot** | 2–3 practices and the rheumatology departments; feedback; clinical safety case |
| **5. Launch and maintain** | Regional launch, update process, BSR 2026 biologic update |

## 7. Open questions

- [ ] Who are the clinical lead and editorial board?
- [ ] Which ICBs are in scope: HNY only, or also West Yorkshire (find WY APC link)?
- [ ] Clinicians only, or patients too?
- [ ] Which conditions: RA/PsA/axSpA only, or also CTD/vasculitis/IBD-overlap?
- [ ] Funding route and amount; who hosts (trust IT, ICB, or commercial host)?
- [ ] Name and branding (NHS identity rules apply if NHS logos are used)
- [x] Regional guideline received (8th ed., 2024). Confirm v3 is the latest
