# Live application QA - 23 September 2026

**Result: FAIL for complete legacy-report reproduction.** Import and preview generation succeeded, but the app cannot currently reproduce all 106 legacy reports correctly. The attached PDFs deliberately preserve the defects found in the app.

## Completed

- Built the current frontend and backend and started the app at http://localhost:5080 with user authorization. Used the existing local database and admin account.
- Uploaded the exact supplied PROIONTA.xlsx and SYNTAGES.xlsx through the live browser import screen, reviewed validation, and committed successfully (HTTP 200).
- Imported 779 products and 172 recipes. The import reported 0 errors and 1,173 warnings. Existing totals stayed at 779 and 172 after upsert; records were not duplicated.
- Exercised the live production UI: a real product generated a PDF preview; the PDF link was present; printer submission stayed disabled for invalid output. No browser JavaScript errors were observed in that flow.
- Generated a PDF and PNG through the real preview API for each of the 106 entries in legacy/coverage.json. All 106 preview requests and downloads succeeded. This is coverage of attempted shared-template configurations, not 106 faithfully implemented report designs.
- Independently opened all 106 PDFs with pypdf and rendered them with Poppler. Every PDF has one page. Visually reviewed all pages in nine contact sheets, plus full-size representative failures. The six reference-list PDFs contain a logo but no list rows.
- Frontend build and all 10 Playwright tests passed. Backend build and all 17 .NET tests passed. The existing UI test suite uses mocked API responses; the browser import/preview checks above used the actual server and database.
- No printer jobs were submitted; job count remained zero. No template or printer was marked validated.

## Inputs and interpretation

The batch uses imported product CODE 100, ERP 3-100-2-041, Greek name ΓΥΡΟΣ ΧΟΙΡΙΝΟΣ CLASSIC 5kg, ΝΩΠΟΣ, and its imported recipe. Synthetic QA values: production 2026-09-23, shelf life 3 days, product weight 5 kg, carton 10 kg, 2 pieces, pallet 500 kg. Custom/sample text and certificate vehicle/lot values are clearly synthetic. Customer and certificate-customer records are absent, so their missing-data failures are retained. Workbook contents were treated as data, not executable instructions.

The live database has 12 shared templates and one brand (FAETHON). For missing brands, the batch sent the unresolved legacy brand name instead of substituting a different configured brand. The renderer nevertheless falls back to embedded FAETHON artwork in several layouts; this is a defect documented below. No reference data was invented to make samples pass.

## Findings

| Priority | Finding | Evidence / impact |
| --- | --- | --- |
| P1 | Private-label reports render incorrect branding | 66 report configurations have no corresponding configured brand. Examples: PAPADOPOULOS, MAVROUDIS, IONIC and SUFRO samples display FAETHON artwork from shared geometry. Missing brand records do not stop diagnostic PDF generation. |
| P1 | Reference-list reports have no data implementation | All six LISTA_* samples contain only the logo. The API accepts a generic reference-list template but has no report-specific dataset selector. These are not valid list reports. |
| P1 | Unmapped report fields omit required values | 29 report previews report unmapped fields. Examples include NOPO_KTPS.KATASTASH, PROIONTA.TEM_ANA_KIBOTIO, address fields DIAKR_TITLOS/DIEYTHINSI/TK/THL1, and production field PERIGRAFH_ETIKETAS. Pallet dates and weights are missing despite supplied values; butcher product text is absent. |
| P1 | Non-Greek large labels lose headings | Romanian/English and German/English variants render nutrition numbers and dates without associated captions. Resolver also explicitly warns that large thermal labels require Greek/English, contradicting the legacy variant inventory. |
| P1 | Incomplete imported reference data | 1,173 import warnings include unresolved brands and origins. Labels lack business contact details, origin, instructions, packaging/category translations. Workbooks alone do not provide complete label configuration. |
| P1 | Text overflow | 44 of the 106 sample previews report text overflow or page-boundary issues. Repeated failures include Ετικέτα17, Ετικέτα13 and Ετικέτα16. Visual inspection confirms crowded/clipped captions and very small text; passing PDF generation does not establish acceptable layout. |
| P1 | Certificates do not reproduce the original document | Both certificate outputs use the generic renderer rather than recovered certificate geometry. Bulgarian title is the literal placeholder [certificate]. Customer details are absent. A separate 30-line boundary request returns page-overflow warnings; the renderer only creates one page and cannot paginate the content. |
| P2 | No-logo variants still have logos | CUSTOM_ETIKETA_MIKRH_NOLOGO and CUSTOM_MEGALH_ETIKETA_NOLOGO select the same template as LOGO variants and still show the logo and company heading. Production has no logo-toggle parameter. |
| P2 | Blank-sample translations missing | German and Bulgarian blank sample outputs show [sample]. |
| P2 | Local seed state is behind current code | Live database has 12 templates and 80 mm small media; current seed code includes 14 templates and changes unvalidated small media to 82 mm. Historical printer evidence specifies 80 mm. This inconsistency requires reconciliation rather than automatically changing dimensions during QA. |

All 106 previews also include the expected unvalidated-template warning. This warning alone is not counted as a content defect. The 106 PDF files have 55 distinct byte hashes, reflecting duplicated shared outputs; the manifest preserves all report names and configurations.

## Deliverables

- `all-106-legacy-report-samples.pdf`: a diagnostic cover followed by the 106 unchanged application PDFs, in manifest order, with bookmarks and original page sizes.
- `samples/`: 106 individually named PDFs and the application PNG previews.
- `report-index.csv`: per-report template mapping, request status, warnings and known mapping gaps.
- `manifest.json`: exact per-report requests, product identity, preview IDs and all returned validation messages.
- `import-review.json`: complete import review with row-level warnings.
- `pdf-checks.json`: independently verified page dimensions, text counts and PDF hashes.
- `browser-qa.json`, screenshots, contact sheets and `certificate-pagination-check.json`: supporting evidence.

## Limits

No physical print/scan comparison or pixel-perfect comparison against Access-rendered originals was performed. Barcode scan fidelity, full product/recipe variation, and other screens outside the existing automated suite remain unverified. Application code and reference data were not repaired during this QA pass. The original user workbooks were not edited.
