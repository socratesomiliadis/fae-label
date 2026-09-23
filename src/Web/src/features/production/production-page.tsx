import { Heading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Catalog } from "@/features/catalog/catalog-page";
import { PrintPreviewPanel } from "@/features/production/print-preview-panel";
import { draftFor } from "@/features/production/production-draft";
import { ProductionForm } from "@/features/production/production-form";
import { useProduction } from "@/features/production/use-production";
import { type Row } from "@/types/records";

export function ProductionPage({
  initial,
  workflow = "production",
}: {
  initial: Row | null;
  workflow?: string;
}) {
  const model = useProduction({ initial, workflow });
  const { draft, setSavedDraft, change, selected } = model;
  if (
    workflow === "production" &&
    !draft.productId &&
    !draft.customerId &&
    draft.templateKey === "thermal-large"
  )
    return (
      <Catalog
        kind="product"
        admin={false}
        labelMode
        onPrint={(p) => change(draftFor(p))}
      />
    );
  return (
    <>
      <Heading
        title={
          workflow === "production"
            ? "Έκδοση ετικετών"
            : (
                {
                  sample: "Δείγμα",
                  custom: "Ελεύθερη ετικέτα",
                  butcher: "Κρεοπωλείο",
                  "production-label": "Προς παραγωγή",
                } as Record<string, string>
              )[workflow]
        }
      >
        {workflow === "production" && selected && (
          <Button
            variant="outline"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            onClick={() => {
              change(draftFor(null));
              setSavedDraft(null);
            }}
          >
            Άλλο προϊόν
          </Button>
        )}
      </Heading>
      <div className="grid items-start gap-5 xl:grid-cols-[1.25fr_1fr]">
        <ProductionForm model={model} workflow={workflow} />
        <PrintPreviewPanel model={model} />
      </div>
    </>
  );
}
