# Comparison with the supplied real legacy label — 24 September 2026

The supplied label is product ERP `3-106-2-000`, product key `113`, recipe `1031`, production 7 July 2026, expiry 10 July 2026, net weight 5 kg, LOT `28/26/10/31062000/3`. The matching product and recipe are present in the archived import and the current local database. Earlier review images used a different product; ingredient/nutrition differences between those products are not missing text.

## Confirmed missing data

| Visible on original | Legacy binding (GR/EN) | Current local database |
| --- | --- | --- |
| ΦΑΕΘΩΝ ΑΒΕΕ / FAETHON SA | EPONYMIES.EPONYMIA_* | Brand name is ΦΑΕΘΩΝ. The local record has no localized names yet; the new seed supplies shortened names, which are not the original company names. |
| Company activity, address, phone, email | EPONYMIES.STOIXEIA_* | Brand `1` has empty `texts`. |
| ΚΑΤΗΓΟΡΙΑ Β1 / CLASS B1 | KATHGORIES.PERIGRAFH_KATHGORIAS_* | `category:Β1` exists with empty `texts`. |
| Reared/slaughtered countries | EKTROFES.EKTROFH_* | Recipe origin key is `1`; no `origin:1` record exists and brand `origins` is empty. |
| Cooking and preservation instructions | ODHGIES_XRHSHS.OD_XRHSHS_* | Product instruction key is `1`; `instructions:1` has empty `texts`. |
| HORECA / HORECA | SYSKEYASIES.SYSKEYASIA_* | Product packaging key is `HOR`; `packaging:HOR` has empty `texts`. |
| ΝΩΠΟ / RAW | PROIONTA.NOPO_KTPS / NOPO_KTPS.KATASTASH_EN | Seeded condition translation is FRESH, which differs from RAW in the original. |

All these controls remain visible and correctly bound in `MEGALH_ETIKETA_FAETHON_GR_EN`. Its RecordSource is `KARTELAKI_GR_EN_FAETHON`. The current resolver reads the matching dictionaries and produces missing-data issues; the renderer receives empty strings for empty/missing records. These particular blanks are not caused by font substitution or fields being removed from the template.

## Why the migration missed these values

`WorkbookReader.Parse` only imports products and recipes. `Seed.Run` creates reference placeholders with codes/names, not the original multilingual reference text. `Extract-Legacy.ps1` exports report/form definitions and assets rather than these reference-table rows.

A read-only inspection of `/Users/socrates/Downloads/FAETHON Labeller/FAETHON LABELLER.accdb` found `EPONYMIES`, `EKTROFES`, `KATHGORIES`, `NOPO_KTPS`, `ODHGIES_XRHSHS`, and `SYSKEYASIES` as linked tables pointing to `\\192.168.1.11\faethon labeller\Database\FAETHON LABELLER_παρ.accdb`. The local frontend SHA256 is `b325b96b97dabbcbc99108d5ec48d2303bd5972d91bab9ed5d439b82287a9481`; it is a different file revision from the earlier Windows definition extraction. No connection to that network location was attempted. No matching backend file was found in the Downloads filename search. The binding names match the checked-in definitions and the sections in the supplied label.

## Formatting differences independent of missing reference rows

- Allergen emphasis is absent from the imported data. Recipe 1031's Greek/English ingredient and allergen cells in the available `SYNTAGES.xlsx` contain no rich-text runs. The application also stores Excel runs only for ingredients, not allergens. Rendering support for bold cannot recover formatting already absent upstream. Original rich-text field values should be exported from Access, rather than inferring allergen spans from string lists.
- The original displays `5,00`; current Fixed formatting uses invariant culture and displays `5.00`. Decimal precision was restored, but the legacy locale was not.
- Legacy barcode human-readable characters are spaced differently. The original definition uses IDAutomationHC39M; the replacement generates Code 39 bars and draws separate human-readable text. That is a remaining visual difference, not evidence the barcode value is missing.
- The supplied full company names supersede the earlier assumption that the bare logo wordmark represented the company-name field. The seeded shortened names should not be described as a faithful recovery.

## Controlled rendering check

Two local PDFs/PNGs were generated for the exact matching product, dates and weight:

- `output/pdf/real-legacy-comparison/current-same-product.pdf`: uses the live resolver and read-only local database. It reports missing company details, origin, instructions, packaging and category translations, plus the missing English company name. The corresponding regions are blank.
- `output/pdf/real-legacy-comparison/screenshot-data-supplied.pdf`: supplies a transcription of the screenshot's missing values to the snapshot **in memory only**, with the same renderer and geometry. Those sections reappear with no renderer overflow/mapping issues. This is a diagnostic reconstruction, not an authoritative migration or approved production label. It retains the original snapshot's resolver warnings because the database was not modified.

No application code or database records were changed by this comparison. No dev server was started. Generated diagnostics are local ignored artifacts.

## Correction to previous validation claims

The earlier 98-layout pass established that supplied content could render without geometry/overflow errors; it did not establish that all original data had been imported. Direct renderer tests bypassed the resolver and accepted empty reference dictionaries. Describing the fixes as complete was too broad. Acceptance must include content assertions for the real product and linked reference data, as well as visual/layout checks.

The next substantive repair is to export and migrate the linked backend tables (including rich text and exact localized names), then resolve this same product through the normal application path and compare its complete output with this real label. A screenshot transcription can demonstrate the cause, but cannot substitute for the missing multilingual source tables across the catalogue.

## Follow-up

The user subsequently authorized seeding the values observed in this label. See [the implementation record](legacy-template-repairs.md#real-label-seed-and-header-correction-24-september-2026). The comparison above records the state before that repair; the recovered subset does not replace a full backend migration.
