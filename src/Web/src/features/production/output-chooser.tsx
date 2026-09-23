import { Field } from "@/components/forms/field";
import { NativeSelect } from "@/components/ui/native-select";
import { labelOptions, languageTitle, outputTitle } from "./label-options";
import type { ProductionModel } from "./use-production";
import { cn } from "@/lib/utils";

export function OutputChooser({
  model,
  workflow,
}: {
  model: ProductionModel;
  workflow: string;
}) {
  const { templates, brands, languages, draft, change, selected, options } =
    model;
  const brand = brands.rows.find((b) => b.key === draft.brandKey);
  const family = model.selectedTemplate?.data.family;
  const families = ["custom", "address", "production", "butcher"].includes(
    family,
  )
    ? [family]
    : workflow === "sample" && family === "sample"
      ? ["sample"]
      : ["thermal", "pallet", "sample"];
  const formats = templates.rows
    .filter((t) => families.includes(t.data.family))
    .flatMap((template) => {
      const available = labelOptions(template, brand, languages.rows);
      const modes = [...new Set(available.map((o) => o.mode))];
      return (modes.length ? modes : ["product"]).map((mode) => ({
        template,
        mode,
        available: available.filter((o) => o.mode === mode),
      }));
    });
  const currentOptions = options.filter((o) => o.mode === draft.mode);
  return (
    <section
      className="rounded-xl border bg-card p-5"
      aria-label="Μορφές ετικέτας"
    >
      <h2 className="mb-1 text-base">Τι θέλετε να εκτυπώσετε;</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Οι μορφές ακολουθούν την επωνυμία. Οι ημερομηνίες και τα βάρη
        διατηρούνται.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {formats.map(({ template, mode, available }) => (
          <button
            key={template.key + mode}
            type="button"
            aria-pressed={
              draft.templateKey === template.key && draft.mode === mode
            }
            disabled={!available.length}
            onClick={() =>
              change({ ...draft, templateKey: template.key, mode })
            }
            className={cn(
              "rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-45 disabled:cursor-not-allowed",
              draft.templateKey === template.key &&
                draft.mode === mode &&
                "border-primary bg-secondary ring-1 ring-primary",
            )}
          >
            <span className="block text-sm font-semibold">
              {outputTitle(template, mode)}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {available.length
                ? `${template.data.widthMm} × ${template.data.heightMm} mm`
                : "Δεν διατίθεται για την επωνυμία"}
            </span>
          </button>
        ))}
      </div>
      {currentOptions.length > 1 ? (
        <Field label="Γλώσσα ετικέτας">
          <NativeSelect
            value={draft.languages.join("/")}
            onChange={(e) => model.set("languages", e.target.value.split("/"))}
          >
            {currentOptions.map((o) => (
              <option key={o.languages.join("/")} value={o.languages.join("/")}>
                {languageTitle(o.languages, languages.rows)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        currentOptions.length === 1 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Γλώσσα ετικέτας: </span>
            {languageTitle(currentOptions[0].languages, languages.rows)}
            <span className="mt-1 block text-xs text-muted-foreground">
              Σταθερή για αυτή τη μορφή.
            </span>
          </p>
        )
      )}
      {!formats.length && (
        <p className="text-sm text-muted-foreground">
          Δεν υπάρχουν διαθέσιμες μορφές.
        </p>
      )}
      {model.selectedTemplate?.data.family === "thermal" &&
        model.selectedTemplate.data.profile === "small" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Μία γλώσσα ανά ετικέτα · βάρος{" "}
            {selected?.data.smallLabelWeight === "carton"
              ? "κιβωτίου"
              : "προϊόντος"}{" "}
            από τη ρύθμιση του προϊόντος.
          </p>
        )}
    </section>
  );
}
