# Production-label audit — 24 September 2026

Scope: the “Προς παραγωγή” screen shown in the supplied screenshot. The source is `legacy/definitions/ETIKETES_KENES_PROS_PARAGOGH.txt`, an Access report over `ETIKETES_PROS_PARAGOGH`.

| Label element | Access definition | Current mapping |
| --- | --- | --- |
| Description below logo | `Κείμενο2`, `ControlSource="PERIGRAFH_ETIKETAS"` (line 815) | `Production.FreeText` in `SharedLayout.Resolve`; present in both compiled layouts |
| Logo | `Εικόνα9`, `Faethon_Logo_DARKPONY` | Recovered image asset |
| Frame | `Πλαίσιο10` | Recovered rectangle |
| ΗΜΕΡΟΜΗΝΙΑ: | Static label `Ετικέτα11` (line 873) | Static caption, no bound date value |
| ΠΡΟΣ ΠΑΡΑΓΩΓΗ: | Static label `Ετικέτα12` (line 893) | Static caption, no bound value |

The report has exactly one bound text control. It contains no bound production date, quantity, LOT, product code, ingredients or weight. Blank spaces beside the two captions are therefore consistent with the legacy definition. The user confirmed that these spaces should remain available for handwriting.

The replacement form exposed `productionDate`, and the request included it, but this report has no date binding. Removed that misleading date input, named the actual input “Περιγραφή ετικέτας”, and added an explanation of the handwritten spaces. Rendering and legacy source definitions remain unchanged.

Separate workflow gaps found during the lookup:

- `legacy/forms/KENES_ETIKETES_PROS_PARAGOGH.txt` edits saved descriptions in `ETIKETES_PROS_PARAGOGH` through `PERIGRAFH_ETIKETAS`.
- `legacy/forms/ANAZHTHSH_KENES_ETIKETES_PROS_PARAGOGH.txt` provides description search, preview filtered by `[CODE]`, and “Εκτύπωση Ετικετών ΟΛΩΝ των Περιγραφών Προς Παραγωγή”.
- The current application saves generic production drafts. There is no dedicated import of this Access description table or equivalent bulk-print-all-descriptions action in the inspected implementation. The checked-in report/form definitions establish the workflow, but do not supply the original saved description rows. These are migration/workflow gaps, not missing bindings in this label, and are not implemented by this change.
