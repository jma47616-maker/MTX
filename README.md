# DMARD Guide (Yorkshire Rheumatology): prototype

An installable web app (PWA) for prescribing and monitoring DMARDs, biologics and
targeted synthetic DMARDs. It is built from the Yorkshire Rheumatology Regional
DMARD Guidelines (8th ed., March 2024) and links out to national BSR guidance and
local shared care protocols. Calculators are an **add-on** on top of the guideline.

> **Prototype for review.** Not clinically approved, no clinical safety case
> (DCB0129/0160), and the calculators are not a registered medical device.

See [PLAN.md](PLAN.md) for the project plan and governance steps.

## What's in it

| Area | Contents |
|---|---|
| Drug pages | 10 csDMARDs, 15 biologics, 6 tsDMARDs from the regional guideline, plus placeholder pages for gaps (bimekizumab, deucravacitinib, voclosporin, anifrolumab, tacrolimus) |
| Topics | Corticosteroids, surgery, vaccination & travel, pregnancy & breastfeeding, biologics overview, references |
| Shared care | Links to the HNY and West Yorkshire APC pages |
| National guidance | BSR 2025 csDMARD, BSR biologic safety (update due 2026), BSR pregnancy, Green Book, MHRA JAK advice, Steroid Emergency Card, eMC, NICE |
| Evidence | Studies chosen by the editorial group (2 of 3 slots still empty) |
| **Calculators (add-on)** | Blood result checker · renal function & renal dose advice · weight-based dosing · steroid converter, safety flags & taper · peri-operative planner · monitoring schedule (copy dates) |

Each drug page links to the calculators that apply to it, with that drug already selected.

## Run locally

No build step is needed; it's static HTML, CSS and JavaScript.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

```bash
npm test          # node --test: calculator logic (thresholds, dates, formulas)
```

## Updating guideline content

The guideline pages are generated from the Word document:

```bash
python3 tools/build_content.py "YORKSHIRE DMARD GUIDELINES 2023 v3.docx"   # needs pandoc
```

This rewrites `content/guideline.json` and `content/media/`. App-authored
content (national links, shared care, gaps, evidence, status notes) lives in
`content/resources.json`. After any content change, bump `VERSION` in `sw.js`
so installed copies pick up the update.

Calculator thresholds live in `js/calc-core.js`. Each one names its source
section, and they must be kept in step with the guideline text.

## Single-file build (claude.ai Artifact)

```bash
python3 tools/build_artifact.py   # writes dist/yorkshire-dmard-guide.html
```

This inlines the CSS, JS, content and images into one file. It runs without a
service worker, which is why the in-app links use plain `#name` fragments
(e.g. `#page--methotrexate`, `#calc--bloods--methotrexate`).

## Deploying

Any static host works: GitHub Pages, an NHS trust web server, Azure Static Web
Apps, and so on. HTTPS is required for offline/install support.

## Before clinical use

- Editorial board review of every page against BSR 2025 and the BSR biologic guideline.
- Clinical safety case and hazard log (DCB0129); MHRA medical device assessment for the calculators.
- Confirm the links marked as unverified: the gov.uk and SPS links (MHRA JAK safety update,
  Green Book, Steroid Emergency Card) couldn't be checked from the build environment, and
  the West Yorkshire shared care link.
- Funding agreement under the ABPI Code of Practice and a sponsorship statement (see About page).
