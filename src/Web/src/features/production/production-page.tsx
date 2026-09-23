import { Heading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Catalog } from "@/features/catalog/catalog-page";
import { PrintPreviewPanel } from "./print-preview-panel";
import { draftFor } from "./production-draft";
import { ProductionForm } from "./production-form";
import { useProduction } from "./use-production";
import { OutputChooser } from "./output-chooser";
import { SelectedProductDetails } from "./selected-product-details";
import { ArrowLeft, Save } from "lucide-react";
import { nameOf } from "@/lib/records";
import type { Row } from "@/types/records";

export function ProductionPage({
  initial,
  workflow = "production",
}: {
  initial: Row | null;
  workflow?: string;
}) {
  const model = useProduction({ initial, workflow });
  const { draft, setSavedDraft, change, selected } = model;
  const choosing =
    workflow === "production" &&
    !draft.productId &&
    !draft.customerId &&
    draft.templateKey === "thermal-large";
  const preparations = (
    <div className="w-full min-w-0 [&>div]:mb-0">
      <Field label="Αποθηκευμένη προετοιμασία">
        <NativeSelect
          value={model.savedDraft?.id || ""}
          onChange={(e) => {
            const r = model.drafts.rows.find((r) => r.id === e.target.value);
            setSavedDraft(r || null);
            change(
              r
                ? r.data
                : {
                    ...draftFor(selected || null),
                    templateKey: draft.templateKey,
                    mode: draft.mode,
                    languages: draft.languages,
                  },
            );
          }}
        >
          <option value="">Νέα προετοιμασία</option>
          {model.drafts.rows.map((r) => (
            <option key={r.id} value={r.id}>
              {nameOf(r)}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
  if (choosing)
    return (
      <>
        {model.drafts.rows.length > 0 && (
          <div className="mb-5 max-w-lg">{preparations}</div>
        )}
        <Catalog
          kind="product"
          admin={false}
          labelMode
          onPrint={(p) =>
            change({
              ...draftFor(p),
              ...(p.data.butcher
                ? { templateKey: "butcher-a4", languages: ["el"] }
                : {}),
            })
          }
        />
      </>
    );
  return (
    <>
      <Heading
        title={
          (
            {
              production: "Έκδοση ετικετών",
              sample: "Δείγμα",
              custom: "Ελεύθερη ετικέτα",
              butcher: "Κρεοπωλείο",
              "production-label": "Προς παραγωγή",
            } as Record<string, string>
          )[workflow]
        }
      />
      <section
        aria-label="Προϊόν και προετοιμασία"
        className="mb-5 flex flex-col gap-4 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        {selected ? (
          <div className="min-w-0 flex-1">
            <h2 className="mb-1 text-lg">{nameOf(selected)}</h2>
            <p className="text-xs">
              <span className="font-mono">{selected.data.erpCode}</span> ·{" "}
              {selected.data.frozen ? "Κατεψυγμένο" : "Νωπό"} ·{" "}
              {selected.data.shelfLife} ημέρες ζωής
            </p>
          </div>
        ) : (
          <p className="text-sm">
            {model.selectedTemplate?.data.name || "Νέα ετικέτα"}
          </p>
        )}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end lg:max-w-[60%]">
          {model.drafts.rows.length > 0 && (
            <div className="min-w-0 sm:w-64">{preparations}</div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={model.busy || !!model.formIssue}
              onClick={model.saveDraft}
            >
              <Save size={16} /> Αποθήκευση
            </Button>
            {selected && (
              <Button
                variant="outline"
                onClick={() => {
                  change({
                    ...draftFor(null),
                    ...(workflow !== "production"
                      ? {
                          templateKey: draft.templateKey,
                          mode: draft.mode,
                          languages: draft.languages,
                        }
                      : {}),
                  });
                  setSavedDraft(null);
                }}
              >
                <ArrowLeft size={16} /> Άλλο προϊόν
              </Button>
            )}
          </div>
        </div>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <OutputChooser model={model} workflow={workflow} />
          <ProductionForm model={model} />
          {selected && model.productNeeded && (
            <SelectedProductDetails model={model} />
          )}
        </div>
        <div className="min-w-0 xl:sticky xl:top-5">
          <PrintPreviewPanel model={model} />
        </div>
      </div>
    </>
  );
}
