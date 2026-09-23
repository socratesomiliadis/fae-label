import catalog from "../../../../Api/Templates/legacy-catalog.json";
import { expiryOf } from "@/features/products/product-utils";
import type { Data, Row } from "@/types/records";

export type LabelOption = {
  templateKey: string;
  mode: string;
  languages: string[];
  report?: string;
};
const independent = ["custom", "address", "production", "sample", "butcher"];
const builtins = [
  "thermal-large",
  "thermal-small",
  "pallet-a4",
  "sample-small",
  "sample-blank",
  "custom-small",
  "custom-large",
  "address-small",
  "production-small",
  "butcher-small",
  "butcher-a4",
];
export function needsProduct(template?: Row, mode = "product") {
  return (
    ["thermal", "pallet"].includes(template?.data.family) ||
    (["sample", "butcher"].includes(template?.data.family) && mode !== "blank")
  );
}
export function labelOptions(
  template: Row,
  brand?: Row,
  languages: Row[] = [],
): LabelOption[] {
  const t = template.data;
  if (t.family.startsWith("certificate") || t.family === "reference-list")
    return [];
  if (
    brand?.data.layoutProfile &&
    needsProduct(template) &&
    brand.data.layoutProfile !== t.profile
  )
    return [];
  const brandName =
    brand?.data.legacyBrand ||
    (brand?.key === "1"
      ? "FAETHON"
      : brand?.data.name || brand?.key || "FAETHON");
  const geometry = t.geometryKey || template.key;
  const newBrand =
    ["thermal", "pallet"].includes(t.family) &&
    !catalog.some((r) => r.brand.toUpperCase() === brandName.toUpperCase());
  if (
    t.legacyReport ||
    (!newBrand &&
      (builtins.includes(geometry) ||
        catalog.some((r) => r.report === geometry)))
  ) {
    return catalog
      .filter((r) => {
        if (t.legacyReport)
          return (
            r.report === t.legacyReport &&
            r.family === t.family &&
            (independent.includes(r.family) ||
              r.brand.toUpperCase() === brandName.toUpperCase())
          );
        return (
          r.family === t.family &&
          (r.profile === t.profile || t.family === "butcher") &&
          r.logo &&
          (independent.includes(r.family) ||
            r.brand.toUpperCase() === brandName.toUpperCase()) &&
          (t.family !== "sample" ||
            r.mode === (geometry === "sample-blank" ? "blank" : "product"))
        );
      })
      .map((r) => ({
        templateKey: template.key,
        mode: r.mode,
        languages: r.languages,
        report: r.report,
      }));
  }
  // A separately designed layout has no recovered report variants. Keep its family constraints.
  const modes =
    t.family === "thermal" && t.profile === "large"
      ? ["product", "carton"]
      : t.family === "production"
        ? ["blank"]
        : t.family === "butcher"
          ? ["product", "blank"]
          : ["product"];
  const pairs =
    t.family === "pallet" || (t.family === "thermal" && t.profile === "large")
      ? [["el", "en"]]
      : languages.map((l) => [l.key]);
  return modes.flatMap((mode) =>
    pairs.map((languages) => ({ templateKey: template.key, mode, languages })),
  );
}
export function matchesOption(draft: Data, option: LabelOption) {
  return (
    draft.templateKey === option.templateKey &&
    draft.mode === option.mode &&
    (draft.languages || []).join("/") === option.languages.join("/")
  );
}
export function outputTitle(template: Row, mode: string) {
  if (template.data.family === "thermal")
    return template.data.profile === "small"
      ? "Μικρή"
      : mode === "carton"
        ? "Κιβώτιο"
        : "Μεγάλη";
  if (template.data.family === "pallet") return "Παλέτα Α4";
  if (template.data.family === "butcher")
    return mode === "blank" ? "Κενά ταμπελάκια" : "Ταμπελάκια";
  return template.data.name;
}
export function languageTitle(languages: string[], rows: Row[]) {
  return languages
    .map((l) => rows.find((r) => r.key === l)?.data.name || l.toUpperCase())
    .join(" + ");
}
export function normalizeDraft(
  next: Data,
  templates: Row[],
  brands: Row[],
  languages: Row[],
  products: Row[],
): Data {
  const template = templates.find((t) => t.key === next.templateKey);
  if (!template) return next;
  const product = products.find((p) => p.id === next.productId);
  const brandKey =
    needsProduct(template, next.mode) &&
    product &&
    !product.data.brands?.includes(next.brandKey)
      ? product.data.brands?.[0] || ""
      : next.brandKey;
  const updated: Data = { ...next, brandKey };
  const options = labelOptions(
    template,
    brands.find((b) => b.key === brandKey),
    languages,
  );
  if (options.some((o) => matchesOption(updated, o))) return updated;
  const match =
    options.find(
      (o) =>
        o.mode === updated.mode && o.languages[0] === updated.languages?.[0],
    ) ||
    options.find((o) => o.mode === updated.mode) ||
    options.find((o) => o.languages[0] === "el") ||
    options[0];
  return match
    ? { ...updated, mode: match.mode, languages: match.languages }
    : updated;
}
export function compatiblePrinters(template: Row | undefined, printers: Row[]) {
  if (!template) return [];
  return printers.filter((p) => {
    const a4 = template.data.profile === "a4";
    if (a4) return p.data.widthMm >= 200;
    if (p.data.widthMm >= 200) return false;
    const rotated = [90, 270].includes(p.data.rotation);
    const w = rotated ? template.data.heightMm : template.data.widthMm;
    const h = rotated ? template.data.widthMm : template.data.heightMm;
    return w <= p.data.widthMm + 0.5 && h <= p.data.heightMm + 0.5;
  });
}

export function productionInputIssue(draft: Data, productNeeded: boolean) {
  if (!draft.productionDate) return "Συμπληρώστε ημερομηνία παραγωγής.";
  if (!productNeeded) return "";
  if (
    !Number.isInteger(draft.shelfLife) ||
    draft.shelfLife < 0 ||
    draft.shelfLife > 9999
  )
    return "Οι ημέρες λήξης πρέπει να είναι ακέραιος από 0 έως 9999.";
  const expiry = expiryOf(draft);
  if (!expiry || expiry < draft.productionDate)
    return "Η λήξη δεν μπορεί να προηγείται της παραγωγής.";
  for (const [key, title] of [
    ["freezeDate", "κατάψυξης"],
    ["packagingDate", "συσκευασίας"],
  ]) {
    if (
      draft[key] &&
      (draft[key] < draft.productionDate || draft[key] > expiry)
    )
      return `Η ημερομηνία ${title} πρέπει να είναι ανάμεσα στην παραγωγή και τη λήξη.`;
  }
  if (
    ["weight", "cartonWeight", "palletWeight", "pieces"].some(
      (k) => draft[k] != null && (!Number.isFinite(draft[k]) || draft[k] < 0),
    )
  )
    return "Τα βάρη και τα τεμάχια δεν μπορούν να είναι αρνητικά.";
  if (draft.pieces != null && !Number.isInteger(draft.pieces))
    return "Τα τεμάχια πρέπει να είναι ακέραιος αριθμός.";
  return "";
}
