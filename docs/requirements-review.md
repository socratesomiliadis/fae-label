# Requirements review

Reviewed against `Label Σωκράτη.docx` and `labeller.docx`, including their embedded examples and the two supplied legacy screenshots, on 23 September 2026. The documents were treated as business requirements, not as instructions to execute actions or contact anyone.

The application now exposes the main workflows described in the documents. This is not a sign-off for production printing: the actual reference data, translations, customer artwork, printer profiles and deployment still need acceptance as described below.

| Requirement | Application coverage |
| --- | --- |
| 2–3 workstations, up to two concurrent users | Shared PostgreSQL database, authenticated API and version checks on edits. Concurrent updates and print-agent serialization are tested; a real multi-PC installation remains an acceptance task. |
| Four operators and an administrator | Admin-created accounts, operator/admin permissions and account disabling. No unnecessary hard limit on the number of accounts. |
| Manual product entry, automatic ID | Product form with server-generated identity, ERP code, both manually assigned barcodes, composition, brand selection, shelf life and flags. |
| Product metadata | Named inputs and reference selectors for abbreviations, Entersoft abbreviation, packaging, packaging state, production department, instructions, Intrastat, ELOGAK, slaughterhouse, supplier, weights, pieces, animal and IONIC codes, detailed description. Required product fields and Intrastat format are validated. |
| Active, daily, private and butcher products | Separate list filters, visible daily status, dedicated butcher flag, active-label exclusion of butcher products. Existing imported records must be classified by an administrator; the import files do not supply the new butcher flag. |
| Product search | Code/description search plus simultaneous abbreviation, recipe family, department, condition and packaging filters. |
| Recipe entry and editing | Code, description, category, family, origin, translated ingredients/allergens/nutrition, structured nutrition table and specification PDF upload/open. Additional nutrition fields remain editable. |
| Recipe search and read-only access | Code/description search, category/family filters, operator read-only forms. Admin editing is enforced on the API. |
| Editable reference lists | Admin list management and grouped selectors, including product conditions. Fresh/frozen semantics are retained for LOT calculation; custom conditions can provide translated label text. |
| Recipe selection follows newly added recipes | Product editors read current recipe records. Recipe identity cannot be renamed independently of its references. |
| Languages | All 16 requested languages are seeded. Product and recipe language tabs use the language catalogue; administrators can add languages and caption translations. Missing translations continue to block affected print jobs. |
| Large bilingual / small single-language labels | GR/EN enforced for large thermal labels; small labels use one language. Small defaults are 100 × 82 mm; large logical pages remain 148 × 100 mm, rotated onto 100 × 148 mm media. |
| Editable label dimensions | Admin template and printer profiles. Initialization upgrades only unvalidated 80 mm small defaults; validated profiles are preserved for physical review. |
| Product and carton output | Presets for product/carton labels, carton pieces and weight, and a per-product choice of product versus carton weight on small labels. |
| A4 pallet output | Available from the same production form, with product, carton and pallet weights. |
| Preview, PDF and direct printing | Preview precedes submission; PDF opens separately. Label size selects the configured large Zebra, small Zebra or A4 printer, with manual selection still available. Windows/Zebra print agents, quantity, validation and immutable job snapshots already exist. Printer commissioning remains required. |
| Production dates and shelf life | Today by default; editable production/freeze dates, days and explicit expiry override. Relevant weight inputs are shown according to output. |
| LOT | Live display and authoritative server calculation use the documented legacy week/year/family/eight-digit ERP/day rule. Sunday=1, Monday=2, frozen=0. Tests cover year boundaries and leap-year expiry. |
| Saved preparations | Save/reopen/edit drafts; changing label format retains production details. Choosing a new preparation clears the saved identity. |
| Daily labels | Tomorrow by default, custom persistent ordering, per-product quantities and editable batch weights. Batch preview and validation precede printing; inactive and butcher products are excluded. |
| Customer directory and address labels | Name/trade-name/VAT/city/country search, city/country filters and direct label action. Operators can edit ordinary customers, following the specific exception in `labeller.docx`. |
| Private-label customers | Separate admin-managed brand catalogue, logo uploads, translated contacts/manufacturer text, origin overrides and layout profile. Operators can update a product's linked brands from its production details through a dedicated version-checked endpoint; editing the actual brand master data remains admin-only. |
| Production labels | Home shortcut, editable free text/title, saved preparations and print preview. |
| Butcher cards and blank cards | Dedicated product category and A4 eight-card output with editable title; blank cards do not require a product. Exact card artwork still needs comparison against approved examples. |
| Sample and free-text labels | Direct home shortcuts; product samples and blank customer samples, language selection, editable text, preview and printing. |
| Bulgaria certificates | Separate export-customer list, saved vehicle suggestions, trailer, shipment date, product lines, cartons, weights, LOT, production/freeze/expiry dates and notes. Product selection supplies initial LOT/expiry. Date filtering and reopening saved certificates are available. Freeze date and carton count are included in rendered output. |
| Certificate PDF and printing | Save, preview and print flow exists. Output overflow is reported and blocks printing. The current renderer uses one page; approved certificate wording/layout and usable line capacity need acceptance. |
| Print history | Product, LOT, dates, operator, quantity and private-label/customer details are retained in job snapshots, with original PDF, status, reprint and resolution actions. |
| Excel bulk import/update | Staged XLSX import, review, commit and stable source identities. Re-import preserves butcher classification and small-label weight preferences that are not present in the original workbook schema. |
| Backups | Scheduled database/assets backup service plus admin status and manual ZIP download. Manual and scheduled backups are serialized. The local launcher supplies the bundled `pg_dump` path; scheduled backups remain disabled in local development. |

## UI changes

- Removed the marketing banner, slogans, eyebrow headings, workspace/environment prose and decorative footer.
- Label issuance starts with a compact product table and filters. A row opens the product's production form.
- Added direct home actions for samples, custom labels, butcher cards and production labels.
- Replaced raw product/recipe data editing with named fields, reference dropdowns and language tabs.
- Kept preview/printing alongside production inputs; added format presets and live LOT/expiry.
- Hid admin-only navigation for operators and kept ordinary customer editing available.

## Acceptance still required

1. **Business data:** complete translated reference texts, language captions, brand contacts/logos/manufacturer text and product classifications. Neither missing translations nor private-label legal/manufacturer wording were invented.
2. **Printed output:** compare each used template and customer profile with approved originals and physically test both Zebra printers and A4 output at actual size. The new blank-sample and butcher-card layouts are functional layouts, not certified replicas. Dynamic nutrition extensions may also require a corresponding print-layout adjustment.
3. **Certificates:** approve the final Bulgarian wording, layout and required certificate identity/fields against the business's authoritative certificate specimen. The attached screenshot is an entry form, not a complete approved output specimen.
4. **Deployment and recovery:** install the API and print helper on the intended network, configure authenticated database access and scheduled backups, create the actual accounts, and rehearse a restore. No dev server, print agent or physical print job was started during this review.

Backend changes and new seeded templates/reference lists take effect when the existing application is restarted through the normal launcher. Initialization is idempotent and preserves validated media profiles.

## Verification

Frontend production build and typecheck passed, along with 7 browser workflow tests using intercepted HTTP responses (no dev server) and 17 .NET domain/integration tests against isolated test databases. The backup test executes the bundled `pg_dump` and verifies the downloadable ZIP contains the database dump and manifest. Browser screenshots were inspected for the dashboard, filtered label table, production form and language-tab product editor. Physical printing, network deployment and restore acceptance were not simulated as successful.
