import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductionModel } from "./use-production";
import { nameOf } from "@/lib/records";

export function AdditionalLabelFields({ model }: { model: ProductionModel }) {
  const {
    customers,
    recipes,
    references,
    draft,
    set,
    selected,
    selectedTemplate,
    productNeeded,
  } = model;
  const family = selectedTemplate?.data.family;
  const beef = ["20", "25", "26", "27"].includes(
    recipes.rows.find((r) => r.key === selected?.data.recipeCode)?.data.family,
  );
  const ionic =
    model.brands.rows.find((b) => b.key === draft.brandKey)?.data
      .legacyBrand === "IONIC";
  return (
    <>
      {productNeeded && (
        <details
          key={String(beef)}
          open={beef}
          className="my-3 rounded-lg border p-3 [&>summary]:cursor-pointer [&>summary]:text-sm"
        >
          <summary>
            Ιχνηλασιμότητα
            {beef ? " · απαιτούνται ζώο και σφαγείο" : " και πρόσθετα στοιχεία"}
          </summary>
          <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
            {[
              ...(beef
                ? [
                    ["animalCode", "Κωδικός ζώου"],
                    ["slaughterhouse", "Αρ. έγκρισης σφαγείου"],
                  ]
                : []),
              ["supplier", "Προμηθευτής"],
              ...(ionic
                ? [
                    ["customerProductCode", "Κωδικός προϊόντος πελάτη (IONIC)"],
                    ["customerOrigin", "Προέλευση πελάτη (IONIC)"],
                  ]
                : []),
              ["labelComment", "Σχόλιο επωνυμίας"],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <Input
                  list={k + "-options"}
                  value={draft[k] || ""}
                  onChange={(e) => set(k, e.target.value)}
                />
              </Field>
            ))}
            <Field label="Ημερομηνία συσκευασίας">
              <Input
                type="date"
                value={draft.packagingDate || ""}
                onChange={(e) => set("packagingDate", e.target.value || null)}
              />
            </Field>
            {["slaughterhouse", "supplier"].map((group) => (
              <datalist key={group} id={group + "-options"}>
                {references.rows
                  .filter((r) => r.data.group === group)
                  .map((r) => (
                    <option key={r.id} value={r.key.replace(group + ":", "")}>
                      {nameOf(r)}
                    </option>
                  ))}
              </datalist>
            ))}
          </div>
        </details>
      )}
      {(family === "address" ||
        (family === "sample" && draft.mode === "blank")) && (
        <Field label="Πελάτης">
          <NativeSelect
            value={draft.customerId || ""}
            onChange={(e) => set("customerId", e.target.value || null)}
          >
            <option value="">
              {family === "address"
                ? "Επιλέξτε πελάτη…"
                : "Χωρίς πελάτη · κενό πλαίσιο"}
            </option>
            {customers.rows.map((c) => (
              <option key={c.id} value={c.id}>
                {nameOf(c)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {["custom", "production", "butcher"].includes(family) && (
        <Field
          label={
            family === "production"
              ? "Περιγραφή ετικέτας"
              : "Ελεύθερο κείμενο / τίτλος"
          }
        >
          <Textarea
            rows={5}
            value={draft.freeText}
            onChange={(e) => set("freeText", e.target.value)}
          />
        </Field>
      )}
      {family === "production" && (
        <p className="text-sm text-muted-foreground">
          Τα πεδία «ΗΜΕΡΟΜΗΝΙΑ» και «ΠΡΟΣ ΠΑΡΑΓΩΓΗ» παραμένουν κενά για
          χειρόγραφη συμπλήρωση μετά την εκτύπωση.
        </p>
      )}
    </>
  );
}
