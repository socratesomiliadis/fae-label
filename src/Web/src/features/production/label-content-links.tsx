import { Button } from "@/components/ui/button";
import { RecordEditor } from "@/features/catalog/record-editor";
import type { ProductionModel } from "./use-production";
import type { Row } from "@/types/records";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

export function LabelContentLinks({
  model,
  admin,
}: {
  model: ProductionModel;
  admin: boolean;
}) {
  const [editing, setEditing] = useState<{ row: Row; kind: string } | null>(
    null,
  );
  const { selected, draft, brands, recipes, references } = model;
  const recipe = recipes.rows.find((r) => r.key === selected?.data.recipeCode);
  const links = [
    { title: "Περιγραφές & barcode προϊόντος", row: selected, kind: "product" },
    {
      title: "Συστατικά, αλλεργιογόνα & διατροφικά",
      row: recipe,
      kind: "recipe",
    },
    {
      title: "Εταιρεία, λογότυπο & κείμενα επωνυμίας",
      row: brands.rows.find((b) => b.key === draft.brandKey),
      kind: "brand",
    },
    {
      title: "Οδηγίες χρήσης & διατήρησης",
      row:
        selected &&
        references.rows.find(
          (r) =>
            r.key ===
            `instructions:${selected?.data.fields?.["Οδηγίες Χρήσης"] || "1"}`,
        ),
      kind: "reference",
    },
    {
      title: "Εκτροφή & προέλευση",
      row: references.rows.find(
        (r) => r.key === `origin:${recipe?.data.originKey}`,
      ),
      kind: "reference",
    },
    {
      title: "Κείμενο συσκευασίας",
      row: references.rows.find(
        (r) =>
          r.key ===
          `packaging:${selected?.data.fields?.["Συσκευασία Προϊόντος"]}`,
      ),
      kind: "reference",
    },
    {
      title: "Κατηγορία προϊόντος",
      row: references.rows.find(
        (r) => r.key === `category:${recipe?.data.category}`,
      ),
      kind: "reference",
    },
    {
      title: "Στοιχεία πελάτη",
      row: model.customers.rows.find((c) => c.id === draft.customerId),
      kind: "customer",
    },
  ];
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-1 text-base">Από πού έρχεται το κείμενο;</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {admin
          ? "Ανοίξτε την πηγή χωρίς να χάσετε την προετοιμασία. Οι αλλαγές ισχύουν και στις επόμενες ετικέτες."
          : "Προβολή των στοιχείων της ετικέτας. Ο διαχειριστής ενημερώνει τα κοινά κείμενα."}
      </p>
      <div className="divide-y">
        {links
          .filter((l) => l.row)
          .map(({ title, row, kind }) => (
            <Button
              key={title}
              variant="ghost"
              className="h-auto min-h-10 w-full justify-between whitespace-normal px-0 py-2 text-left text-xs"
              onClick={() => setEditing({ row: row!, kind })}
            >
              {title}
              <ArrowUpRight className="shrink-0" size={14} />
            </Button>
          ))}
      </div>
      {editing && (
        <RecordEditor
          row={editing.row}
          kind={editing.kind}
          editable={admin || editing.kind === "customer"}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            model.change(model.draft);
            await Promise.all([
              model.products.reload(),
              recipes.reload(),
              brands.reload(),
              references.reload(),
              model.customers.reload(),
            ]);
          }}
        />
      )}
    </section>
  );
}
