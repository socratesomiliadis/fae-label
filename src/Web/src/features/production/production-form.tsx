import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AdditionalLabelFields } from "./additional-label-fields";
import { draftFor } from "./production-draft";
import { ProductionValues } from "./production-values";
import type { ProductionModel } from "./use-production";
import { nameOf } from "@/lib/records";

export function ProductionForm({ model }: { model: ProductionModel }) {
  const {
    products,
    draft,
    error,
    productSearch,
    setProductSearch,
    change,
    selected,
    productNeeded,
  } = model;
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 text-base">
        {productNeeded ? "Στοιχεία παραγωγής" : "Περιεχόμενο ετικέτας"}
      </h2>
      <Notice text={error || products.error || model.templates.error} />
      {productNeeded && !selected && (
        <>
          <Field label="Αναζήτηση προϊόντος">
            <Input
              placeholder="Κωδικός ή περιγραφή"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </Field>
          <Field label="Προϊόν">
            <NativeSelect
              value={draft.productId || ""}
              onChange={(e) => {
                const p =
                  products.rows.find((p) => p.id === e.target.value) || null;
                change({
                  ...draftFor(p),
                  templateKey: draft.templateKey,
                  mode: draft.mode,
                  languages: draft.languages,
                });
                model.setSavedDraft(null);
              }}
            >
              <option value="">Επιλέξτε προϊόν…</option>
              {products.rows
                .filter(
                  (p) =>
                    p.data.active &&
                    (model.selectedTemplate?.data.family === "butcher"
                      ? p.data.butcher
                      : !p.data.butcher) &&
                    `${p.data.erpCode} ${nameOf(p)}`
                      .toLocaleLowerCase("el")
                      .includes(productSearch.toLocaleLowerCase("el")),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.data.erpCode} · {nameOf(p)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        </>
      )}
      <ProductionValues model={model} />
      <AdditionalLabelFields model={model} />
    </section>
  );
}
