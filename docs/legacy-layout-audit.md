# Legacy layout audit — 23 September 2026

Historical pre-fix findings; implementation and validation are recorded in [Legacy template repairs](legacy-template-repairs.md#layout-fidelity-follow-up-23-september-2026).

Scope: compare all 106 exported Access reports with `src/Api/Templates/legacy-layouts.json`, then inspect compilation, variant selection, asset selection and rendering behavior. This is an audit, not an implementation of fixes. No application, template or database changes were made.

## What matches

An independent read-only parser expanded inherited control defaults and compared 5,479 controls. Control counts, names, bindings, font family/size, bold/italic flags, alignment codes and image names match. All 1,840 captions and exported static visibility values match. Every visible image node has an asset mapping.

The coordinate/size comparison found 26 differing properties across 23 controls in 19 reports. All are accounted for by `scripts/legacy-layout-adjustments.mjs`: wider Zlaths LOT fields, Dutch condition captions, a Polish caption and Italian expiry/weight positioning. No unexplained geometry drift was found in these checked properties. This does not establish visual equivalence: omitted properties and runtime interpretation are significant.

## Findings directly relevant to the screenshots

### 1. Small logo: correct box, wrong image at runtime

`MIKRH_ETIKETA_FAETHON_GR` specifies image `Faethon_Logo_ΜΙΚΡΗ` in control `Εικόνα11`: x=0.794 mm, y=1.323 mm, width=24.007 mm, height=7.426 mm. The recovered asset is `legacy/assets/089_Faethon_Logo_ΜΙΚΡΗ.jpg`, a horizontal black logo with the emblem on the left and FAETHON lettering on the right. All 16 FAETHON small-language variants select this asset.

`LegacyAssets.Import` initializes the brand's logo to the tall `LOGO 4` image. `SharedLayout.Draw` replaces every image whose name contains LOGO with the brand logo whenever one exists. Consequently the correct horizontal image is replaced by the tall image and centered in its wide box, reproducing the narrow, indented appearance in screenshot 1.

Fix direction: retain each report's original artwork for built-in brands; distinguish an intentional uploaded override from the automatically seeded default. Preserve custom-brand overrides and their existing behavior.

### 2. Header font: the source says Calibri Bold, and this Mac resolves it correctly

| Report | Control | Font | Size | Alignment | Top |
| --- | --- | --- | --- | --- | --- |
| Small Greek | Κείμενο2 | Calibri, weight 700 | 6 pt | Center | 0 mm |
| Large Greek/English | Κείμενο2 | Calibri, weight 700 | 9 pt | Right | 0.529 mm |
| Large Greek/English | Κείμενο4 | Calibri, weight 700 | 9 pt | Left | 0.547 mm |

The compiled definitions preserve these settings. A standalone probe using the current `LabelFonts.Resolve` implementation and SkiaSharp 3.119.1 returned actual **Calibri, weight 700, upright** for the bold header on this Mac. Regular Calibri, Arial Black and Courier New also resolved to their named families. Carlito fallback exists but was not used by this probe.

The earlier possibility that this machine was using Carlito is therefore not supported by the runtime check. Windows/Skia rasterization and baseline differences remain possible; historical Windows font files and an original Access-rendered comparison were not available for this audit. Do not replace the header font speculatively.

### 3. Header language fields collapse into one name

The large report binds `EPONYMIES.EPONYMIA_GR` and `EPONYMIES.EPONYMIA_EN` independently. `SharedLayout.Resolve` strips the suffix and returns the single `Brand.Name` for both. `ReferenceData` has no dictionary of localized brand names. The layout's two fields are intentional; repeating the Greek name in both is a data-model/resolution limitation. The English source value must be recovered or supplied, not guessed.

### 4. Large ingredients heading is overpainted

The legacy large logo box ends at y=17.480 mm. `Ετικέτα13` (Συστατικά:) starts at y=16.704 mm, with horizontal overlap. The renderer traverses the exported controls and draws the logo after the heading. Its opaque image covers the heading's upper part, consistent with screenshot 2.

The overlap is present in the source geometry; it was not introduced by coordinate conversion. A deliberate layering or spacing correction is needed. The export alone does not prove how Access visually resolved the overlapping controls.

### 5. Conditional caption missed

Screenshot 2 retains `Sl.Appr.No:` for a pork product. The report's `Report_Load` code explicitly hides `Ετικέτα26` for family 10 and the other listed non-beef families. The new renderer hides the bound slaughterhouse value but its caption-string checks do not match `Sl.Appr.No:`. The adjacency-based compatibility rule also did not assign a condition to this node.

Fix direction: preserve explicit control-identity conditions from the legacy report logic instead of relying on caption wording or proximity alone. The presence of code in an export is not proof every event ran historically, but this rule and the screenshot provide a concrete mismatch to address.

## Broader rendering discrepancies

Counts below describe source controls across the full inventory, including reference lists and certificates that have adapted rendering paths.

| Area | Evidence | Current behavior / effect |
| --- | --- | --- |
| Italics | 46 controls in 27 reports set FontItalic | Flag is imported, but `LabelFonts.Resolve` receives only family and bold; italic is never applied. |
| Light font weight | 696 controls in 26 reports specify weight 300 | Compiler reduces weight to a bold boolean, rendering light as normal. Header weight 700 is unaffected. Actual visual difference depends on available font faces. |
| Rich text | 389 controls in 92 reports set TextFormat=1 | The renderer strips HTML. Inline emphasis, including bold allergens, is lost; HTML paragraph/break tags are also removed instead of converted to line breaks. |
| Distributed alignment | 228 controls in 71 reports use TextAlign=4 | Code only implements center (2), right (3), otherwise left. Ingredients/allergens on the small Greek label are affected. |
| Borders | 211 label/textbox controls in 63 reports use OldBorderStyle=1 | Compiler checks BorderStyle, which is absent from these exports, so those border flags are false. Explicit BorderWidth/BorderColor are also not preserved; shared lines/frames use fixed black strokes. |
| Text growth/shrinkage | 13 controls set CanGrow; 28 set CanShrink | Neither behavior is imported. Relevant especially to address and free-text labels. The two screenshot ingredient controls do not set CanGrow, so enabling growth everywhere is not a source-faithful fix. |
| Date/number formatting | 395 controls specify Format; 568 specify DecimalPlaces | Shared binding resolution hardcodes d/M/yyyy and 0.### rather than each control's format. Weight precision and some date presentations can differ. |
| Image sizing | 12 list images use SizeMode=1; one certificate footer uses 0 | SizeMode is omitted; shared image rendering always preserves aspect ratio and centers. The 12 list images belong to intentionally adapted lists, so this is not necessarily an active shared-layout bug there. Certificate footer needs comparison. All 351 image controls use centered PictureAlignment=2, which matches current centering. |
| Text placement/overflow | SharedLayout.Text | Baselines depend on each line's glyph bounds, line spacing is hardcoded to 1.05× font size, and a line failing the size check is omitted completely with an issue. Measurement and shaping use different logical sizes. These are candidates for the remaining cutoffs, not proven explanations for every clipped pixel. |
| Nutrition headings | Source captions combine several columns using spaces | Caption is preserved verbatim, but spacing depends on font metrics. It is not a real column layout. Font/rendering differences can move the apparent headings. |

Access documents [TextAlign=4 as Distribute](https://learn.microsoft.com/en-us/office/vba/api/access.textbox.textalign), [font weights 300/400/700 as Light/Normal/Bold](https://learn.microsoft.com/en-us/office/vba/api/access.textbox.fontweight), and the distinct [Clip/Stretch/Zoom image sizing behaviors](https://learn.microsoft.com/en-us/office/vba/api/access.image.sizemode).

## Existing intentional deviations

- Code 39 bars are generated with ZXing instead of rendered using IDAutomationHC39M. Barcode geometry and human-readable text are not pixel-identical by design.
- Six reference lists and two certificates use adapted pagination/composition. Their final output should not be described as a direct reproduction of all source coordinates.
- Existing documentation records large thermal content as 148×100 mm in 108×148 mm rotated stock. There is also an unresolved consistency issue: `docs/legacy-printing.md` records small stock as 100×80 mm, while `Seed.Run` migrates unvalidated small templates/printers to 82 mm. This affects bottom whitespace/physical setup, not the logo substitution. Verify the intended small stock before changing it.

## Suggested implementation order

1. Correct built-in logo overrides, localized brand names and explicit conditional captions.
2. Resolve heading/logo layering and use consistent measured/shaped text baselines; verify the screenshot labels visually.
3. Preserve rich text, italic/weight, distributed alignment, borders and field-specific formats.
4. Handle growth, certificate image modes and the documented stock-height discrepancy with explicit label/page constraints.

Verification performed: definition comparison, asset inspection, source-code tracing and a standalone font-resolution probe. No dev server was started. No new Windows Access export, full render matrix, database mutation, physical print or barcode scan was performed. Existing pre-task changes were not altered.
