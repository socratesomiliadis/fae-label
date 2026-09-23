# Legacy printing investigation

Fresh extraction on 23 September 2026 from `C:/Users/Socrates/Downloads/FAETHONLabeller/FAETHON LABELLER.accdb`; source SHA256 `61515D2A3F8335A71A101A6D46F888EF7907396E179D4CFDE936CA5FBACBB981`.

The extraction used an isolated copy with startup form removed, no AutoExec macro, and automation macro security disabled. The original database was not modified. No previously generated exports or mock backend were used. There are 106 report definitions, 65 form definitions and 98 recovered assets in `legacy/`. Reproduce the printing inventory with `node scripts/inspect-legacy-printing.mjs`.

## Observed path

In `legacy/forms/KARTELAKI_FAETHON.txt`, the large-label button opens `MEGALH_ETIKETA_FAETHON_GR_EN` using `OpenReport`, view `2` (Print Preview), filtered by `[PROIONTA.CODE]`. The embedded macro XML explicitly names Print Preview. Across the freshly exported forms there are 111 such preview actions and 28 Report View actions for reference lists. The supplied screenshots show Access's standard Windows print dialog selecting ZDesigner or Kyocera queues.

This supports the path **Access report → Access Print Preview → Windows driver/queue → printer**. No application-generated ZPL or direct socket printing was found in the inspected form/report definitions. This is not a claim about unavailable backend code or an actual captured spool job.

The replacement defaults to **resolved shared layout → Skia PDF/image preview → paired Windows helper → .NET PrintDocument → Windows driver/queue → printer**. It deliberately follows the legacy Windows-driver route. It is not the Access report engine, so font metrics and rasterisation can differ. Optional RAW ZPL remains an alternative configuration, not the default.

## Profiles from supplied screenshots

| Output | Windows queue | Media | Orientation |
|---|---|---|---|
| Large thermal | `ZDesigner ZT411-203dpi ZPL (Αντίγραφο 1)` | 108 × 148 mm | 90°, landscape |
| Small thermal | `Zebra ZT230-Network` | 100 × 80 mm | 0°, portrait |
| Certificates / pallet sheets | `ECOSYS MA5500ifx` | A4 | Per document |

The ZT230 screenshot names the driver `ZDesigner ZT230-200dpi ZPL`; its nominal 203-dpi hardware is represented at 8 dots/mm. Large layout content is 148 × 100 mm inside the configured stock. No fit-to-page scaling is applied. Media dimensions supersede the earlier assumed 100 × 148 / 100 × 82 sizes.

**Saved report printer settings are not necessarily production settings.** For example, both the large and small FAETHON reports contain saved A4 paper ID 9, 600 dpi, 100% scale, one copy and margins around 4.2 mm. These disagree with the user screenshots. The fresh `legacy/printing-evidence.json` retains decoded settings and margins for all reports, but these binary driver settings must not be copied into the new queues. Establish final offsets with an actual print comparison, including hard margins and Zebra calibration.

The original reports use `IDAutomationHC39M`, a Code 39 barcode font. The replacement generates Code 39 bars without requiring that font. This preserves the intended symbology, not proven pixel-identical bar widths. Scan comparison, quiet zones and long codes remain acceptance checks.

## Installation needed for physical tests

No Zebra or Kyocera queue was installed on this development PC when inspected; only Adobe PDF, Microsoft Print to PDF, Fax and AnyDesk Printer were present. Development and PDF previews do not require printer drivers.

Before physical testing, install the model-specific ZPL Windows drivers from Zebra's official [ZT411 support](https://www.zebra.com/us/en/support-downloads/printers/industrial/zt411.html) and [ZT230 support](https://www.zebra.com/us/en/support-downloads/printers/industrial/zt230.html) pages. Zebra currently recommends driver v10 there. Zebra Setup Utilities is optional for configuration/calibration; ZebraDesigner label-design software is not needed by this application. Install the Kyocera MA5500ifx Windows driver for A4 output.

Install/configure queues on each computer that runs a printing helper. The backend alone does not need drivers. Queue names may differ from the legacy names if the application profile and helper allowlist are updated together. The helper's Windows service identity must have access to those queues; a queue visible only in an interactive user's session is insufficient.

Set media, orientation and single-sided printing. Keep driver scaling at 100%. Preserve the physical printer's correct gap sensing, speed, darkness and calibration; screenshots do not establish these. Do not infer printer IP addresses from the queue names.

## Acceptance still required

Dispatch is disabled by default and output configurations remain unvalidated. Compare printed originals with new output at actual size for every mapped configuration. Check alignment, text wrapping, bold allergens, logos, approval marks, long translations, product/carton weights, and barcode/QR scans. Certificates need pagination comparison as well. Mark a configuration validated only after its content and physical result have been accepted.

The helper records queue submission, not physical printing. It fixes driver copies to one and emits the requested number of pages itself. A crash or ambiguous submission becomes uncertain and requires operator review; it is never automatically resent. No physical print test has been performed in this workspace.
