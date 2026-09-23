# Legacy report QA after template repairs

Date: 2026-09-23. Live app: http://localhost:5080.

Both supplied workbooks were imported in the original QA pass: 779 products and 172 recipes, with no import errors and 1,173 warnings. This follow-up uses those records without importing them again.

## Results

| Check | Original samples | Repaired samples |
| --- | ---: | ---: |
| Reports generated | 106 | 106 |
| Reports with unmapped-field warnings | 29 | 0 |
| Reports with renderer overflow warnings | 44 | 0 |

The repaired set contains 152 report pages; the combined PDF contains 153 pages including its cover. All PDFs passed the structural/nonblank audit. All 106 first-page previews and representative full-size renders were visually reviewed. These results apply to the selected sample product, not every possible product and input.

The app now exposes 22 template choices. Eight choices were added to the seed set of fourteen: two no-logo labels and six reference lists. Exact brand/language variants are selected from the recovered definitions. Blank samples and A4 butcher labels use recovered geometry. Reference lists contain actual imported data and paginate (39 pages for shelf-life, 9 for recipes). Certificate pagination is repaired.

## Validation

- Backend: 23 tests passed, including a regression rendering all 98 label definitions with imported product/recipe content.
- Frontend: build succeeded and 10 Playwright tests passed.
- Live browser: recipe-list preview generated nine pages, displayed its source report and page count, and disabled the single-page printer action; no JavaScript errors were observed.
- Diff whitespace check passed.

## Remaining limits

- Missing brand, customer/contact, origin and other reference data still produce warnings. No records were fabricated to hide missing information.
- The two certificates still use the generic document layout; native Access certificate fidelity remains outstanding. Reference lists use adapted readable tables rather than identical Access geometry.
- The sample label is product CODE 100, using actual imported recipe content and synthetic QA production dates, weights, vehicle and free text. Other products, long field values and rich-text/allergen formatting need broader acceptance testing.
- No Zebra printer was connected, no physical print jobs were submitted, and no template was marked validated. PDF success does not constitute physical barcode or media calibration approval.

## Files

- `all-106-legacy-report-samples.pdf`: bookmarked combined review copy.
- `samples/*.pdf`: individual report samples.
- `report-index.csv`: report index.
- `manifest.json`: requests, selected sources and remaining warnings.
- `pdf-checks.json`: per-report PDF audit results.
- `live-ui-check.json` and `live-list-preview.png`: live browser evidence.

Implementation details: `docs/legacy-template-repairs.md` in the repository. Original files under `legacy/definitions` were preserved.
