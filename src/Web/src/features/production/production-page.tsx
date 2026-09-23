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
import { LabelContentLinks } from "./label-content-links";
import { nameOf } from "@/lib/records";
import type { Row } from "@/types/records";

export function ProductionPage({
  initial,
  workflow = "production",
  admin = false,
}: {
  initial: Row | null;
  workflow?: string;
  admin?: boolean;
}) {
  const model = useProduction({ initial, workflow });
  const { draft, setSavedDraft, change, selected } = model;
  const choosing =
    workflow === "production" &&
    !draft.productId &&
    !draft.customerId &&
    draft.templateKey === "thermal-large";
  const preparations = (
    <div className="mb-5 max-w-lg">
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
        {preparations}
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
      >
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
            Άλλο προϊόν
          </Button>
        )}
      </Heading>
      {selected && (
        <div className="mb-5 border-l-4 border-primary pl-4">
          <p className="text-xs font-mono text-muted-foreground">
            {selected.data.erpCode}
          </p>
          <h2 className="my-1 text-xl">{nameOf(selected)}</h2>
          <p className="text-xs text-muted-foreground">
            {selected.data.frozen ? "Κατεψυγμένο" : "Νωπό"} ·{" "}
            {selected.data.shelfLife} ημέρες ζωής
          </p>
        </div>
      )}
      {model.drafts.rows.length > 0 && preparations}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(350px,1fr)]">
        <div className="xl:col-start-1 xl:row-start-1">
          <ProductionForm model={model} />
        </div>
        <div className="space-y-5 xl:col-start-2 xl:row-start-1 xl:row-span-2">
          <OutputChooser model={model} workflow={workflow} />
          <PrintPreviewPanel model={model} />
        </div>
        <div className="space-y-5 xl:col-start-1">
          {selected && model.productNeeded && (
            <SelectedProductDetails model={model} />
          )}
          <LabelContentLinks model={model} admin={admin} />
        </div>
      </div>
    </>
  );
}
