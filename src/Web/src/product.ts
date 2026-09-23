import { type Data, type Row } from "./api";

export const productLists = [
  ["Συντομογραφία", "abbreviation"],
  ["Συσκευασία Προϊόντος", "packaging"],
  ["Κατάσταση Συσκ.", "packaging-state"],
  ["Τμήμα Παραγωγής", "department"],
  ["Οδηγίες Χρήσης", "instructions"],
  ["ΕΛΟΓΑΚ", "elogak"],
  ["Προμηθευτής", "supplier"],
  ["Αρ.Εγκρ.Σφ.", "slaughterhouse"],
] as const;
export const groupNames: Record<string, string> = {
  condition: "Καταστάσεις προϊόντων",
  abbreviation: "Συντομογραφίες",
  packaging: "Συσκευασίες",
  "packaging-state": "Καταστάσεις συσκευασίας",
  department: "Τμήματα παραγωγής",
  instructions: "Οδηγίες χρήσης",
  elogak: "ΕΛΟΓΑΚ",
  supplier: "Προμηθευτές",
  slaughterhouse: "Σφαγεία",
  family: "Οικογένειες",
  category: "Κατηγορίες",
  origin: "Εκτροφή / προέλευση",
};
export function productValue(
  row: Row,
  field: string,
  recipes: Row[] = [],
): string {
  if (field === "family")
    return String(
      recipes.find((r) => r.key === row.data.recipeCode)?.data.family || "",
    );
  if (field === "condition") return row.data.frozen ? "Κατεψυγμένο" : "Νωπό";
  return String(row.data.fields?.[field] || "");
}
export function expiryOf(d: Data) {
  if (d.expiryOverride) return d.expiryOverride;
  if (!d.productionDate) return "";
  const date = new Date(d.productionDate + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + Number(d.shelfLife || 0));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
// Access DatePart("ww", date, Sunday, FirstDay), as used by the legacy LOT.
export function lotOf(d: Data, product?: Row, recipe?: Row) {
  if (
    !product ||
    !recipe ||
    !/^\d-\d{3}-\d-\d{3}$/.test(product.data.erpCode) ||
    !/^\d{2}$/.test(recipe.data.family) ||
    !d.productionDate
  )
    return "—";
  const date = new Date(d.productionDate + "T12:00:00Z");
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12));
  const week =
    Math.floor(
      ((date.getTime() - first.getTime()) / 86400000 + first.getUTCDay()) / 7,
    ) + 1;
  return `${String(week).padStart(2, "0")}/${String(date.getUTCFullYear()).slice(-2)}/${recipe.data.family}/${product.data.erpCode.replaceAll("-", "")}/${product.data.frozen ? 0 : date.getUTCDay() + 1}`;
}
export function defaultWeight(product: Row | null, field: string) {
  const value = String(product?.data.fields?.[field] ?? "").replace(",", ".");
  return value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
}
