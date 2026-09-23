# Legacy template repairs

The compiler now preserves all 106 reports in `legacy-layouts.json` alongside the twelve original shared profiles. `legacy-catalog.json` describes the supported brand/language/mode combinations. Source definitions remain unchanged; narrow compatibility adjustments are documented in `scripts/legacy-layout-adjustments.mjs`.

The resolver chooses the exact source variant for built-in families. A brand's `legacyBrand` is its source token (for example `METEORA`, `SUFRO`, or `PAPADOPOULOS`); FAETHON's existing key `1` remains supported. Unknown numeric brand identities are not guessed. Administrators can enter the source token in the brand editor. Custom user geometry remains authoritative and validated profiles are not silently replaced during seeding. A newly selected variant does not inherit physical validation from another variant.

Eight template choices are added to the existing fourteen: small/large no-logo custom labels and six reference lists. The existing blank-sample and A4 butcher choices now use the recovered report geometry. Lists use the actual imported data and paginate; blank reference descriptions stay blank rather than inventing their translations. Their table presentation is adapted for legibility, not claimed pixel-identical to Access.

Access fields for pieces, condition, production text, customer address/contact and butcher titles are mapped. Ionic customer code/origin and Zlaths packaging date/comment have explicit production inputs. Missing values remain blocking warnings. The exact recovered brand artwork is preserved rather than overwritten with the generic FAETHON logo.

Text measurement uses enlarged unhinted metrics before conversion back to millimetres. Measuring glyph bounds directly at a 2–3 logical-pixel font rounds bounds enough to discard dates and narrow captions, even when the final PDF has ample resolution. A source-specific adjustment widens the Zlaths LOT field, two translated captions, and gives the Italian expiry caption two lines. Conditional labels follow the associated animal/slaughterhouse/freeze field.

PDF rendering paginates reference tables and certificates. The PNG preview displays page one; preview responses include `pageCount` and `sourceReport`. The single-raster printer transport rejects multi-page documents instead of silently submitting only page one; these must be printed through the PDF.

The certificate follow-up restores Access `BreakHeader` / `BreakFooter` and `FormHeader` / `FormFooter` sections and correctly trims the `NotDefault` visibility flag. `CertificateLayouts` composes section-relative coordinates on A4, preserving the exported letterhead, declarations and approval images. Conformance restores the missing recipient/company block, uses five readable table rows per page with continuous numbering, and prints imported Intrastat codes. Bulgarian certificates honor the explicit page break: each product/lot receives its own two-page pair, with that product's recipe ingredients, dates, cartons and weight. This prevents different products from sharing ambiguous date columns. The supplied BG PDF's four pages for one product included unwanted spillover; fresh and frozen products now intentionally produce two complete pairs. Narrow cells and the overprinted packing statement are reflowed. Source declarations are reproduced, not updated or independently certified.

Uploaded brand logos now override the logo slot in recovered label layouts, and custom-label headings use the selected brand's name. Unmatched private brands do not inherit FAETHON's QR link. Fixed manufacturer approval artwork remains part of the underlying label layout.

`scripts/qa-certificate-private-label.mjs` generates live PDFs with two fictional brands, customer details and uploaded test logos. Fixtures are archived in a `finally` block; original products are not edited. `scripts/qa-certificate-audit.py` checks pages, lot coverage and private-label names, and creates a compact combined review PDF. Generated PDF/image/ZIP files under `output` are ignored. Previously tracked QA binaries are removed only from the Git index and remain on disk; existing Git history is not rewritten.

## Verification

The live QA batch uses imported product CODE 100 and the same synthetic production inputs as the initial pass. All 106 reports generate PDFs. A regression test renders all 98 non-certificate/non-list definitions with the real imported product and recipe; additional tests cover variant selection, no-logo layouts, reference-list pagination, certificate pagination and fractional font measurements.

The follow-up passed 25 backend tests and 10 frontend tests. Its ten live PDF exports contain 18 pages, including a 30-line conformance document and fresh/frozen Bulgarian pairs. Live browser verification confirms page count guidance and a disabled single-raster action for multi-page certificates.

The sample set is not exhaustive product coverage. Missing master data, rich-text/allergen fidelity, unusually long certificate fields, and physical barcode/print acceptance remain separate requirements. No template is marked validated by these changes.
