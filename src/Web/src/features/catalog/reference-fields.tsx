import { Field } from "@/components/forms/field";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { groupNames } from "@/features/products/product-utils";
import { RecordField } from "./record-field";
import type {
  BusinessFieldsModel,
  BusinessFieldsProps,
} from "./use-business-fields";

export function ReferenceFields({
  model,
  data,
  onChange,
  disabled,
  extra,
}: BusinessFieldsProps & { model: BusinessFieldsModel }) {
  const { set } = model;
  return (
    <>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <RecordField
          name="name"
          label="Περιγραφή"
          required
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <Field label="Λίστα">
          <NativeSelect
            required
            disabled={disabled}
            value={data.group || ""}
            onChange={(e) => set("group", e.target.value)}
          >
            <option value="">Επιλέξτε…</option>
            {Object.entries(groupNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {data.group === "condition" && (
        <label className="mb-3 flex items-center gap-2.5 py-2.5 text-sm [&_input]:size-4 [&_input]:min-h-0 [&_input]:accent-primary">
          <Checkbox
            disabled={disabled}
            checked={!!data.frozen}
            onCheckedChange={(checked) => set("frozen", checked)}
          />
          Κατεψυγμένο (LOT με κατάληξη 0)
        </label>
      )}
      {extra(
        {
          texts: data.texts || { el: "", en: "" },
          complete: data.complete || false,
        },
        (d) => onChange({ ...data, ...d }),
      )}
    </>
  );
}
