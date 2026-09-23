import { productValue } from "@/features/products/product-utils";
import { nameOf } from "@/lib/records";
import type { Row } from "@/types/records";

type CatalogFilters = {
  search: string;
  filter: string;
  fields: Record<string, string>;
  kind: string;
  recipes: Row[];
  labelMode: boolean;
};

export function filterCatalog(
  rows: Row[],
  { search, filter, fields, kind, recipes, labelMode }: CatalogFilters,
) {
  const query = search.toLocaleLowerCase("el");
  const fieldFilters = Object.entries(fields).filter(([, value]) => value);
  return rows.filter((row) => {
    const data = row.data;
    const searchable = [
      nameOf(row),
      row.key,
      data.erpCode,
      data.family,
      JSON.stringify(data.fields || {}),
      data.vat,
      data.city,
      data.country,
      data.tradeName,
      data.category,
    ]
      .join(" ")
      .toLocaleLowerCase("el");
    if (!searchable.includes(query)) return false;
    const matchesStatus =
      filter === "all" ||
      (filter === "active" && data.active) ||
      (filter === "inactive" && !data.active) ||
      (filter === "daily" && data.daily) ||
      (filter === "butcher" && data.butcher) ||
      (filter === "private" &&
        data.brands?.some((brand: string) => brand !== "1"));
    if (!matchesStatus) return false;
    if (
      labelMode &&
      (!data.active || (filter === "butcher" ? !data.butcher : data.butcher))
    )
      return false;
    return fieldFilters.every(
      ([key, value]) =>
        (kind === "product"
          ? productValue(row, key, recipes)
          : String(data[key] || "")) === value,
    );
  });
}
