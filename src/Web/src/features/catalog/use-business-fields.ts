import { useRows } from "@/hooks/use-records";
import { type Data } from "@/types/records";
import { useState, type ReactNode } from "react";
export type BusinessFieldsProps = {
  kind: string;
  data: Data;
  onChange: (data: Data) => void;
  disabled: boolean;
  extra: (data: Data, change: (data: Data) => void) => ReactNode;
};
export function useBusinessFields({ data, onChange }: BusinessFieldsProps) {
  const reference = useRows("reference");
  const recipe = useRows("recipe");
  const brand = useRows("brand");
  const languages = useRows("language");
  const lookups = {
    reference: reference.rows,
    recipe: recipe.rows,
    brand: brand.rows,
    language: languages.rows,
  };
  const [language, setLanguage] = useState("el");
  const error =
    reference.error || recipe.error || brand.error || languages.error;
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const refs = (group: string) =>
    (lookups.reference || []).filter((r) => r.data.group === group);
  const languageRows = lookups.language || [];
  const languageKeys = [
    ...new Set([
      "el",
      ...languageRows.map((r) => r.key),
      ...Object.keys(data.names || data.translations || {}),
    ]),
  ];

  return {
    lookups,
    language,
    setLanguage,
    error,
    set,
    refs,
    languageRows,
    languageKeys,
  };
}
export type BusinessFieldsModel = ReturnType<typeof useBusinessFields>;
