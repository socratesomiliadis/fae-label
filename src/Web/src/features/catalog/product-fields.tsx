import { Field } from "@/components/forms/field";
import { LanguageTabs } from "@/components/forms/language-tabs";
import { RecordOptions } from "@/components/forms/record-options";
import { RecordField } from "./record-field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { productLists } from "@/features/products/product-utils";
import { nameOf } from "@/lib/records";
import type {
  BusinessFieldsModel,
  BusinessFieldsProps,
} from "./use-business-fields";

export function ProductFields({
  model,
  data,
  onChange,
  disabled,
}: BusinessFieldsProps & { model: BusinessFieldsModel }) {
  const { lookups, language, error, set, refs, languageRows, languageKeys } =
    model;
  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-amber-900 [&_svg]:mt-0.5 [&_svg]:shrink-0"
        >
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <RecordField
          name="erpCode"
          label="Κωδικός ERP"
          required
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="secondaryCode"
          label="Δευτερεύων κωδικός"
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="barcode"
          label="Barcode προϊόντος"
          required
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="cartonBarcode"
          label="Barcode κιβωτίου"
          required
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="recipeCode"
          label="Σύσταση"
          options={lookups.recipe}
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <Field label="Ημέρες λήξης">
          <Input
            type="number"
            min={0}
            max={9999}
            required
            disabled={disabled}
            value={data.shelfLife ?? 0}
            onChange={(e) => set("shelfLife", Number(e.target.value))}
          />
        </Field>
        <Field label="Κατάσταση">
          <NativeSelect
            disabled={disabled}
            value={
              data.fields?.["Κατάσταση Προϊόντος"] ||
              (data.frozen ? "ΚΤΨ" : "ΝΩΠΟ")
            }
            onChange={(e) =>
              onChange({
                ...data,
                frozen:
                  refs("condition").find(
                    (r) => r.key === "condition:" + e.target.value,
                  )?.data.frozen ?? e.target.value === "ΚΤΨ",
                fields: {
                  ...data.fields,
                  "Κατάσταση Προϊόντος": e.target.value,
                },
              })
            }
          >
            <option value="ΝΩΠΟ">Νωπό</option>
            <option value="ΚΤΨ">Κατεψυγμένο</option>
            {refs("condition")
              .filter(
                (r) => !["condition:ΝΩΠΟ", "condition:ΚΤΨ"].includes(r.key),
              )
              .map((r) => (
                <option key={r.id} value={r.key.replace("condition:", "")}>
                  {nameOf(r)}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Βάρος μικρής ετικέτας">
          <NativeSelect
            disabled={disabled}
            value={data.smallLabelWeight || "product"}
            onChange={(e) => set("smallLabelWeight", e.target.value)}
          >
            <option value="product">Προϊόντος</option>
            <option value="carton">Κιβωτίου</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="my-4 flex flex-wrap justify-end gap-3">
        {[
          ["active", "Ενεργό"],
          ["daily", "Καθημερινό"],
          ["butcher", "Κρεοπωλείου"],
        ].map(([k, label]) => (
          <label
            className="mb-3 flex items-center gap-2.5 py-2.5 text-sm [&_input]:size-4 [&_input]:min-h-0 [&_input]:accent-primary"
            key={k}
          >
            <Checkbox
              disabled={disabled}
              checked={!!data[k]}
              onCheckedChange={(checked) => set(k, checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <h3>Επωνυμίες</h3>
      <div className="flex flex-wrap gap-x-5">
        {(lookups.brand || []).map((b) => (
          <label
            className="mb-3 flex items-center gap-2.5 py-2.5 text-sm [&_input]:size-4 [&_input]:min-h-0 [&_input]:accent-primary"
            key={b.id}
          >
            <Checkbox
              disabled={disabled}
              checked={(data.brands || []).includes(b.key)}
              onCheckedChange={(checked) =>
                set(
                  "brands",
                  checked
                    ? [...(data.brands || []), b.key]
                    : data.brands.filter((k: string) => k !== b.key),
                )
              }
            />
            {nameOf(b)}
          </label>
        ))}
      </div>
      <h3>Περιγραφή ετικέτας</h3>
      <LanguageTabs languages={languageKeys} rows={languageRows} />
      <TabsContent value={language}>
        <Field label={`Περιγραφή (${language.toUpperCase()})`}>
          <Textarea
            rows={2}
            disabled={disabled}
            required={language === "el"}
            value={data.names?.[language] || ""}
            onChange={(e) =>
              set("names", { ...data.names, [language]: e.target.value })
            }
          />
        </Field>
      </TabsContent>
      <h3>Στοιχεία προϊόντος</h3>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {productLists.map(([field, group]) => (
          <Field key={field} label={field}>
            <NativeSelect
              disabled={disabled}
              value={data.fields?.[field] || ""}
              onChange={(e) =>
                set("fields", { ...data.fields, [field]: e.target.value })
              }
            >
              <RecordOptions
                value={data.fields?.[field]}
                rows={refs(group)}
                prefix={group + ":"}
              />
            </NativeSelect>
          </Field>
        ))}
        {[
          "Συντομογραφία ENTERSOFT",
          "Κωδ. Intrastat",
          "Αναλ.Περιγραφή",
          "Κωδικός IONIC",
          "Κωδικός Ζώου",
          "Βάρος Προϊόντος",
          "Τεμ./Κιβ.",
          "Βάρος Κιβωτίου",
        ].map((field) => (
          <Field key={field} label={field}>
            <Input
              disabled={disabled}
              value={data.fields?.[field] || ""}
              onChange={(e) =>
                set("fields", { ...data.fields, [field]: e.target.value })
              }
            />
          </Field>
        ))}
      </div>
    </>
  );
}
