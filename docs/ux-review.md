# Label workflow UX review

Reviewed on 24 September 2026 against both supplied Word documents, all 32 embedded images, and the checked-in Access forms, report definitions and recovered report catalog. The documents were read as business requirements and examples, not as instructions to execute actions.

## Workflow decision

`labeller.docx` describes opening a product, changing production dates and weights, saving those values, and issuing several kinds of labels from the same screen. Its product screen (`word/media/image16.png`) and the corresponding screen in `Label Σωκράτη.docx` (`word/media/image11.png`) show shared production values beside explicit print actions. `legacy/forms/KARTELAKI_FAETHON.txt` confirms that those actions open specific reports in Print Preview.

The replacement now follows that arrangement: a persistent product heading, shared production details, output cards, and preview/printing. There are no independent template, mode and second-language selectors. Selecting another output retains the production values. Saved preparations can be reopened from the product selection screen as well as inside the workspace.

## Requirements and changes

| Evidence / requirement | UX change |
| --- | --- |
| Large product and carton labels use different weights; small labels use the product's configured weight source (`Label Σωκράτη.docx`, section 3). | Product/carton output actions control relevant inputs. A small carton-weight label shows carton weight without requiring carton piece count. Pallet output exposes all three weights. |
| The documents describe bilingual large labels and single-language small labels. Actual Access reports contain additional brand-specific pairs. | Output choices read the same `legacy-catalog.json` used by the renderer. FAETHON small labels expose 16 single-language variants, IONIC two, and SUFRO/MAVROUDIS/METEORA their recovered variants. Large MAVROUDIS DE/EN and METEORA/SUFRO RO/EN remain available. Unsupported pairs and modes are unavailable. |
| Pallet, product sample, blank sample, butcher cards and custom text are distinct reports. | Output cards select the complete mode. Pallets retain GR/EN. Blank samples offer their four recovered languages; product samples use their recovered Greek report. Blank/customer/custom outputs hide production traceability inputs. Certificates and reference-list reports are excluded from product output choices. |
| Product values must remain editable after saving and usable for several outputs (`labeller.docx`, Labels). | Format switches retain values, product selection retains the intended output mode, and reopening old drafts normalizes incompatible language/mode combinations. Draft saves ignore late responses if the operator has changed preparation. |
| Both documents require company/brand contact details, logo and manufacturer text; private-label text can override origin. | Navigation explicitly names companies and brands. A Label Content area groups company text, shared references and headings. A dedicated brand editor exposes translated company heading, company description/contact details, manufacturer statement and origin override. Reference text editing also uses language tabs. |
| Admins edit master data; operators view it, with the ordinary customer exception. | Contextual source drawers open the exact product, recipe, brand, instructions, origin, packaging, category or customer record without leaving the preparation. Existing role restrictions remain enforced. Master-data changes invalidate the preview. |
| Preview before printing; different printer/media sizes for different outputs. | Printer choices filter by media dimensions and rotation, with configured size defaults. An unvalidated selected printer cannot enable submission. Missing compatible printers leave preview/PDF available. |
| Dates and LOT are derived from production, with manual expiry supported. | LOT/expiry remain visible. Invalid date ranges, negative quantities and non-integer carton counts are explained before preview. A freeze date still equal to the previous production date follows a production-date change; independently changed freeze dates are retained. |

`LabelCompatibility` checks the recovered combinations again on the server; unsupported requests become blocking preview issues, so hiding controls is not the sole protection. Independently designed layouts and newly created brands without recovered artwork retain generic family constraints and the existing content/translation/physical-validation checks. Adding a language to the language catalog does not manufacture an unverified recovered layout for an existing brand.

## Verification

- Frontend typecheck and isolated production build.
- 18 browser tests passed, with regression coverage for format/brand changes, valid bilingual exceptions, saved preparations, small-label weight source, printer compatibility, source navigation, operator restrictions, stale preview responses, invalid dates/quantities and narrow screens.
- 64 backend tests passed (3 private-workbook tests skipped), covering every recovered report's language/mode combination, representative invalid combinations, and resolver blocking issues.
- Desktop product workspace, company editor, content hub and mobile workspace screenshots inspected.

Browser workflow tests intercept API responses. Backend integration tests use isolated PostgreSQL databases. No production records or printer jobs were created for this review. Physical printer acceptance and the existing missing-translation/content checks remain necessary; this pass does not certify printed artwork. Three private-workbook tests are skipped when those input files are absent.

The build used `npm run build -- --outDir ../../artifacts/ux-web` to avoid replacing static assets served by the existing development API. Restart/build through the normal local launcher to load the complete updated application.

## Visual hierarchy follow-up

The subsequent screenshot review led to a more compact product/preparation toolbar and a two-column working area. Format selection comes first, with a fixed order (large product, carton, small, pallet, sample, blank sample). Preview starts at the same vertical position; production inputs sit below the format choices. Company/product/recipe source-edit links have been removed from this workspace; their catalog navigation remains available.

Shared tabs now use a bordered group and an explicit, high-contrast selected state. The prior line-tab rules overrode active backgrounds. Secondary table actions have visible button boundaries; ordinary links are underlined; disclosure rows have consistent chevrons and focus states. Desktop and mobile views were inspected, and 20 browser tests passed, including keyboard tab navigation and workspace alignment. No backend behavior changed in this follow-up.

The verified frontend was then loaded into the existing local app without restarting the API. Assets were copied before atomically replacing the entry page; previous hashed assets were retained for already-open tabs. HTTP checks confirmed the running app serves the new entry page and its assets. Refreshing the app loads this visual follow-up.
