import { Field } from "@/components/forms/field";
import { RecordOptions } from "@/components/forms/record-options";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Data, Row } from "@/types/records";

type RecordFieldProps = {
  name: string;
  label: string;
  data: Data;
  onChange: (data: Data) => void;
  disabled: boolean;
  required?: boolean;
  options?: Row[];
  prefix?: string;
};

/** A scalar catalog field, optionally backed by a reference list. */
export function RecordField({
  name,
  label,
  data,
  onChange,
  disabled,
  required,
  options,
  prefix,
}: RecordFieldProps) {
  const control = {
    value: data[name] || "",
    disabled,
    required,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => onChange({ ...data, [name]: event.target.value }),
  };
  return (
    <Field label={label}>
      {options ? (
        <NativeSelect {...control}>
          <RecordOptions value={control.value} rows={options} prefix={prefix} />
        </NativeSelect>
      ) : (
        <Input {...control} />
      )}
    </Field>
  );
}
