import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AdditionalLabelFields } from "./additional-label-fields";
import { draftFor } from "./production-draft";
import { ProductionValues } from "./production-values";
import type { ProductionModel } from "./use-production";
import { nameOf } from "@/lib/records";
import { Save } from "lucide-react";

export function ProductionForm({ model }: { model: ProductionModel }) {
  const {
    products,
    brands,
    draft,
    error,
    busy,
    productSearch,
    setProductSearch,
    change,
    set,
    selected,
    productNeeded,
    saveDraft,
  } = model;
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h2 className="mb-1 text-base">
            {productNeeded
              ? "Στοιχεία αυτής της παραγωγής"
              : "Περιεχόμενο ετικέτας"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {productNeeded
              ? "Κοινά στοιχεία για τις εκτυπώσεις του προϊόντος."
              : "Συμπληρώστε μόνο όσα θα εμφανιστούν στην εκτύπωση."}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy || !!model.formIssue}
          onClick={saveDraft}
        >
          <Save size={15} /> Αποθήκευση
        </Button>
      </div>
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
      {productNeeded && (
        <Field label="Επωνυμία στην ετικέτα">
          <NativeSelect
            value={draft.brandKey}
            onChange={(e) => set("brandKey", e.target.value)}
          >
            {!draft.brandKey && (
              <option value="">Συνδέστε μια επωνυμία με το προϊόν</option>
            )}
            {brands.rows
              .filter((b) => !selected || selected.data.brands?.includes(b.key))
              .map((b) => (
                <option key={b.id} value={b.key}>
                  {nameOf(b)}
                </option>
              ))}
          </NativeSelect>
        </Field>
      )}
      <ProductionValues model={model} />
      <AdditionalLabelFields model={model} />
    </section>
  );
}
