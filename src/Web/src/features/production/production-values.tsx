import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import type { ProductionModel } from "@/features/production/use-production";
import { expiryOf, lotOf } from "@/features/products/product-utils";
export function ProductionValues({ model }: { model: ProductionModel }) {
  const { recipes, draft, set, selected, selectedTemplate, productNeeded } =
    model;
  return (
    productNeeded && (
      <>
        <div className="my-3 flex flex-wrap gap-x-6 gap-y-3 rounded-lg bg-muted p-3.5 text-xs [&_b]:mt-1 [&_b]:block [&_b]:font-mono [&_b]:text-sm">
          <span>
            LOT{" "}
            <b>
              {lotOf(
                draft,
                selected,
                recipes.rows.find((r) => r.key === selected?.data.recipeCode),
              )}
            </b>
          </span>
          <span>
            Ανάλωση έως <b>{expiryOf(draft)}</b>
          </span>
        </div>
        <h3>Ημερομηνίες & ποσότητες</h3>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 2xl:grid-cols-3">
          {[
            ["productionDate", "Ημερομηνία παραγωγής"],
            ["freezeDate", "Ημερομηνία κατάψυξης"],
            ["expiryOverride", "Χειροκίνητη ημερομηνία λήξης"],
          ]
            .filter(([k]) => k !== "freezeDate" || selected?.data.frozen)
            .map(([k, l]) => (
              <Field key={k} label={l}>
                <Input
                  type="date"
                  value={draft[k] || ""}
                  onChange={(e) => set(k, e.target.value || null)}
                />
              </Field>
            ))}
          {[
            ["shelfLife", "Ημέρες λήξης"],
            ["weight", "Βάρος προϊόντος (kg)"],
            ["pieces", "Τεμάχια / κιβώτιο"],
            ["cartonWeight", "Βάρος κιβωτίου (kg)"],
            ["palletWeight", "Βάρος παλέτας (kg)"],
          ]
            .filter(
              ([k]) =>
                k === "shelfLife" ||
                k === "weight" ||
                (k === "palletWeight" &&
                  selectedTemplate?.data.family === "pallet") ||
                (["pieces", "cartonWeight"].includes(k) &&
                  (draft.mode === "carton" ||
                    selected?.data.smallLabelWeight === "carton" ||
                    selectedTemplate?.data.family === "pallet")),
            )
            .map(([k, l]) => (
              <Field key={k} label={l}>
                <Input
                  type="number"
                  min="0"
                  max={k === "shelfLife" ? 9999 : undefined}
                  step={["shelfLife", "pieces"].includes(k) ? 1 : "0.001"}
                  value={draft[k] ?? ""}
                  onChange={(e) =>
                    set(
                      k,
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </Field>
            ))}
        </div>
        {draft.expiryOverride && (
          <p className="mt-3 text-xs text-muted-foreground">
            Η λήξη έχει οριστεί χειροκίνητα και δεν υπολογίζεται από τις ημέρες
            ζωής.
          </p>
        )}
      </>
    )
  );
}
