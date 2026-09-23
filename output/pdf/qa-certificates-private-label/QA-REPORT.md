# Certificates and private-label QA

Date: 2026-09-23. The live app uses the previously imported 779 products and 172 recipes.

## Implemented

- Restored the conformance certificate's missing Access group header, manufacturer and recipient details, source declarations, letterhead and approval marks. Rebuilt the narrow product table with readable cells and continuous numbering across pages. Intrastat comes from imported product fields.
- Restored the Bulgarian report's explicit two-page structure. Each product/lot gets its own certificate pair with the correct recipe ingredients, production/expiry/freeze dates, cartons, total weight and calculated weight per carton. The overlapping packing statement is composed as one field. Repeated source date columns are not used to mix products.
- Corrected the Access parser's handling of group sections and hidden controls.
- Fixed private-label logo overrides and hard-coded custom-label brand names. An unmatched private brand no longer inherits FAETHON's QR image.
- Certificate preview shows the total page count; multi-page output uses PDF printing.

## Live exports and validation

Ten PDFs, 18 pages total:

| Sample | Pages |
| --- | ---: |
| Conformance, fresh and frozen products | 1 |
| Conformance, 30 distinct lot rows | 6 |
| Bulgarian, fresh and frozen product pairs | 4 |
| NORTHSTAR QA: large, small, custom labels | 3 |
| HELIOS QA: large, small, custom labels | 3 |
| Fictional customer address label | 1 |

The two brands, customer addresses, VAT placeholder, contact details, logos and production inputs are fictional QA data. The actual imported product and recipe content is used. Test records were archived after export; original products were not changed. No physical print jobs were submitted.

All ten exports have zero renderer overflow and unmapped-field warnings. PDF audit checks page counts, nonblank pages, all 30 lot identifiers exactly once, product/lot pairing across Bulgarian pages and correct custom-label brand names. The combined PDF is bookmarked. Representative full-size pages and all-page contact sheets were visually reviewed.

Backend: 25 tests passed, including all 98 label variants, two-page certificate pairing and actual logo-pixel replacement. Frontend: build and 10 Playwright tests passed. Live browser: four-page preview guidance visible, direct printer button disabled, no JavaScript errors. Whitespace checks passed.

Remaining warnings are physical template validation and missing instructions/packaging/category translations on product labels. Source certificate declarations and manufacturer artwork are reproduced from exports; this is not independent approval of their current business content. Unusually long names, ingredients, lots or notes may require further layout adjustment and will retain overflow warnings.

## Git footprint

Generated PDFs, images and ZIPs under `output` are ignored. 331 previously tracked QA binaries (about 177 MB) are removed from the index but remain available locally. Existing Git history has not been rewritten. Compact manifests/reports and reproducible QA scripts remain eligible for version control; source layout JSON is a runtime resource, not a QA binary. No commit was created.

Review `certificates-and-private-label-samples.pdf`; individual exports, `manifest.json`, `pdf-checks.json` and `live-ui-check.json` sit alongside it. See `docs/legacy-template-repairs.md` for implementation details and the two QA scripts under `scripts` for reproduction.
