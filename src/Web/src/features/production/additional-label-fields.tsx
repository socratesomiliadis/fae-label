import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductionModel } from "@/features/production/use-production";
import { nameOf } from "@/lib/records";
export function AdditionalLabelFields({ model }: { model: ProductionModel }) {
  const {
    customers,
    recipes,
    references,
    draft,
    set,
    selected,
    productNeeded,
  } = model;
  return (
    <details
      className="col-span-full my-2 mb-4 rounded-lg border p-3 [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:justify-between [&>summary]:py-1 [&>summary]:text-sm [&>summary]:text-muted-foreground [&[open]>summary]:mb-4"
      open={
        !productNeeded ||
        ["20", "25", "26", "27"].includes(
          recipes.rows.find((r) => r.key === selected?.data.recipeCode)?.data
            .family,
        )
      }
    >
      <summary>
        {productNeeded ? "Ιχνηλασιμότητα" : "Περιεχόμενο ετικέτας"}
      </summary>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {[
          ["animalCode", "Κωδικός ζώου"],
          ["slaughterhouse", "Αρ. έγκρισης σφαγείου"],
          ["supplier", "Προμηθευτής"],
        ].map(([k, l]) => (
          <Field key={k} label={l}>
            <Input
              list={k + "-options"}
              value={draft[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </Field>
        ))}
        {[
          ["slaughterhouse", "slaughterhouse"],
          ["supplier", "supplier"],
        ].map(([key, group]) => (
          <datalist key={key} id={key + "-options"}>
            {references.rows
              .filter((r) => r.data.group === group)
              .map((r) => (
                <option key={r.id} value={r.key.replace(group + ":", "")}>
                  {nameOf(r)}
                </option>
              ))}
          </datalist>
        ))}
        <Field label="Πελάτης">
          <NativeSelect
            value={draft.customerId || ""}
            onChange={(e) => set("customerId", e.target.value || null)}
          >
            <option value="">Επιλέξτε…</option>
            {customers.rows.map((c) => (
              <option key={c.id} value={c.id}>
                {nameOf(c)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Ελεύθερο κείμενο / τίτλος">
        <Textarea
          value={draft.freeText}
          rows={4}
          onChange={(e) => set("freeText", e.target.value)}
        />
      </Field>
    </details>
  );
}
