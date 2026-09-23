import { defaultWeight } from "@/features/products/product-utils";
import { today } from "@/lib/dates";
import { nameOf } from "@/lib/records";
import { type Data, type Row } from "@/types/records";

export function draftFor(product: Row | null, offset = 0): Data {
  return {
    productId: product?.id || null,
    name: product ? nameOf(product) : "",
    productionDate: today(offset),
    freezeDate: product?.data.frozen ? today(offset) : null,
    shelfLife: product?.data.shelfLife || 0,
    expiryOverride: null,
    weight: defaultWeight(product, "Βάρος Προϊόντος"),
    pieces: defaultWeight(product, "Τεμ./Κιβ."),
    cartonWeight: defaultWeight(product, "Βάρος Κιβωτίου"),
    palletWeight: null,
    animalCode: "",
    slaughterhouse: product?.data.fields?.["Αρ.Εγκρ.Σφ."] || "",
    supplier: product?.data.fields?.["Προμηθευτής"] || "",
    brandKey: product?.data.brands?.[0] || "1",
    mode: "product",
    languages: ["el", "en"],
    templateKey: "thermal-large",
    freeText: "",
    customerId: null,
  };
}
