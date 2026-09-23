import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AdditionalLabelFields } from "@/features/production/additional-label-fields";
import { draftFor } from "@/features/production/production-draft";
import { ProductionValues } from "@/features/production/production-values";
import { SelectedProductDetails } from "@/features/production/selected-product-details";
import type { ProductionModel } from "@/features/production/use-production";
import { nameOf } from "@/lib/records";
import { Eye, Save } from "lucide-react";
export function ProductionForm({
  model,
  workflow,
}: {
  model: ProductionModel;
  workflow: string;
}) {
  const {
    products,
    templates,
    brands,
    languages,
    drafts,
    draft,
    error,
    busy,
    savedDraft,
    setSavedDraft,
    productSearch,
    setProductSearch,
    scope,
    setScope,
    change,
    set,
    selected,
    selectedTemplate,
    productNeeded,
    makePreview,
    saveDraft,
  } = model;
  return (
    <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4 [&_h2]:mb-0 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2]:text-base">
        <h2>Στοιχεία παραγωγής</h2>
      </div>
      <div className="p-5">
        <Notice text={error || products.error || templates.error} />
        <div
          className="mb-4 flex flex-wrap gap-1.5 [&_button]:h-auto [&_button]:rounded-md [&_button]:border [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-xs"
          aria-label="Μορφές ετικέτας"
        >
          {[
            ["thermal-large", "product", "Μεγάλη GR/EN"],
            ["thermal-large", "carton", "Κιβώτιο GR/EN"],
            ["thermal-small", "product", "Μικρή"],
            ["pallet-a4", "product", "Παλέτα Α4"],
            ["sample-small", "product", "Δείγμα"],
            ["sample-blank", "blank", "Κενό δείγμα"],
            ["butcher-a4", "product", "Ταμπελάκια Α4"],
            ["butcher-a4", "blank", "Κενά ταμπελάκια"],
          ]
            .filter(([key]) => templates.rows.some((t) => t.key === key))
            .map(([key, mode, label]) => (
              <Button
                variant="ghost"
                type="submit"
                key={key + mode}
                className={
                  draft.templateKey === key && draft.mode === mode
                    ? "!border-primary bg-secondary text-primary font-semibold"
                    : ""
                }
                onClick={() => {
                  change({
                    ...draft,
                    templateKey: key,
                    mode,
                    languages: ["thermal-large", "pallet-a4"].includes(key)
                      ? ["el", "en"]
                      : [draft.languages[0]],
                  });
                  if (key.startsWith("butcher")) setScope("butcher");
                }}
              >
                {label}
              </Button>
            ))}
        </div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Πρότυπο">
            <NativeSelect
              value={draft.templateKey}
              onChange={(e) => {
                const t = templates.rows.find((t) => t.key === e.target.value);
                change({
                  ...draft,
                  templateKey: e.target.value,
                  languages:
                    t?.data.profile === "small"
                      ? [draft.languages[0]]
                      : t?.data.family === "thermal"
                        ? ["el", "en"]
                        : draft.languages,
                });
              }}
            >
              {templates.rows
                .filter((t) => !t.data.family.startsWith("certificate"))
                .map((t) => (
                  <option key={t.id} value={t.key}>
                    {nameOf(t)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Αποθηκευμένη προετοιμασία">
            <NativeSelect
              value={savedDraft?.id || ""}
              onChange={(e) => {
                const r = drafts.rows.find((r) => r.id === e.target.value);
                if (r) {
                  change(r.data);
                  setSavedDraft(r);
                } else {
                  setSavedDraft(null);
                  change({
                    ...draftFor(selected || null),
                    templateKey: draft.templateKey,
                    languages: draft.languages,
                  });
                }
              }}
            >
              <option value="">Νέα προετοιμασία</option>
              {drafts.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {nameOf(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {productNeeded && (!selected || workflow !== "production") && (
          <div>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field label="Λίστα προϊόντων">
                <NativeSelect
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="active">Ενεργές ετικέτες</option>
                  <option value="private">Private label</option>
                  <option value="butcher">Κρεοπωλείου</option>
                </NativeSelect>
              </Field>
              <Field label="Αναζήτηση προϊόντος">
                <Input
                  placeholder="Κωδικός ή περιγραφή"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
        {productNeeded && (!selected || workflow !== "production") && (
          <Field label="Προϊόν">
            <NativeSelect
              value={draft.productId || ""}
              onChange={(e) => {
                const p =
                  products.rows.find((p) => p.id === e.target.value) || null;
                change({
                  ...draftFor(p),
                  templateKey: draft.templateKey,
                  languages: draft.languages,
                });
                setSavedDraft(null);
              }}
            >
              <option value="">Επιλέξτε προϊόν…</option>
              {products.rows
                .filter(
                  (p) =>
                    p.data.active &&
                    (scope === "butcher" ? p.data.butcher : !p.data.butcher) &&
                    (scope !== "private" ||
                      p.data.brands?.some((b: string) => b !== "1")) &&
                    (p.id === draft.productId ||
                      (p.data.erpCode + " " + nameOf(p))
                        .toLocaleLowerCase("el")
                        .includes(productSearch.toLocaleLowerCase("el"))),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.data.erpCode} · {p.data.secondaryCode} · {nameOf(p)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        )}
        <SelectedProductDetails model={model} />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Επωνυμία">
            <NativeSelect
              value={draft.brandKey}
              onChange={(e) => set("brandKey", e.target.value)}
            >
              {brands.rows
                .filter(
                  (b) => !selected || selected.data.brands.includes(b.key),
                )
                .map((b) => (
                  <option key={b.id} value={b.key}>
                    {nameOf(b)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Περιεχόμενο">
            <NativeSelect
              value={draft.mode}
              onChange={(e) => set("mode", e.target.value)}
            >
              <option value="product">Προϊόν</option>
              <option value="carton">Κιβώτιο</option>
              {["butcher", "sample", "custom", "production"].includes(
                selectedTemplate?.data.family,
              ) && <option value="blank">Κενό / ελεύθερο</option>}
            </NativeSelect>
          </Field>
          <Field label="Γλώσσα">
            <NativeSelect
              disabled={
                selectedTemplate?.data.family === "thermal" &&
                selectedTemplate?.data.profile === "large"
              }
              value={draft.languages[0]}
              onChange={(e) =>
                set("languages", [e.target.value, ...draft.languages.slice(1)])
              }
            >
              {languages.rows.map((l) => (
                <option key={l.id} value={l.key}>
                  {nameOf(l)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {selectedTemplate?.data.profile !== "small" && (
            <Field label="Δεύτερη γλώσσα">
              <NativeSelect
                disabled={
                  selectedTemplate?.data.family === "thermal" &&
                  selectedTemplate?.data.profile === "large"
                }
                value={draft.languages[1] || ""}
                onChange={(e) =>
                  set(
                    "languages",
                    e.target.value
                      ? [draft.languages[0], e.target.value]
                      : [draft.languages[0]],
                  )
                }
              >
                <option value="">Χωρίς δεύτερη γλώσσα</option>
                {languages.rows
                  .filter((l) => l.key !== draft.languages[0])
                  .map((l) => (
                    <option key={l.id} value={l.key}>
                      {nameOf(l)}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        <ProductionValues model={model} />
        <AdditionalLabelFields model={model} />
        <div className="my-4 flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            disabled={busy}
            onClick={saveDraft}
          >
            <Save size={16} />
            Αποθήκευση
          </Button>
          <Button
            variant="default"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            disabled={busy}
            onClick={makePreview}
          >
            <Eye size={17} />
            {busy ? "Προετοιμασία…" : "Προεπισκόπηση"}
          </Button>
        </div>
      </div>
    </section>
  );
}
