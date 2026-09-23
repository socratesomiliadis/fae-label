import { useState } from "react";
import { Field } from "@/components/forms/field";
import { LanguageTabs } from "@/components/forms/language-tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ObjectFields } from "./object-fields";
import { useRows } from "@/hooks/use-records";
import type { Data } from "@/types/records";

export function BrandFields({
  data,
  onChange,
  disabled,
}: {
  data: Data;
  onChange: (data: Data) => void;
  disabled: boolean;
}) {
  const languages = useRows("language");
  const [language, setLanguage] = useState("el");
  const keys = [
    ...new Set([
      "el",
      ...languages.rows.map((l) => l.key),
      ...Object.keys(data.names || {}),
      ...Object.keys(data.texts || {}),
      ...Object.keys(data.manufacturer || {}),
      ...Object.keys(data.origins || {}),
    ]),
  ];
  const translated = ["names", "texts", "manufacturer", "origins"];
  const setTranslation = (key: string, value: string) =>
    onChange({ ...data, [key]: { ...data[key], [language]: value } });
  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground">
        Η εταιρική επωνυμία, η περιγραφή και τα στοιχεία επικοινωνίας
        εμφανίζονται στην κεφαλίδα της ετικέτας. Συμπληρώστε κάθε γλώσσα που
        χρησιμοποιείτε.
      </p>
      <Field label="Όνομα επωνυμίας στη λίστα">
        <Input
          disabled={disabled}
          value={data.name || ""}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
        />
      </Field>
      <Tabs value={language} onValueChange={(v) => setLanguage(String(v))}>
        <LanguageTabs languages={keys} rows={languages.rows} />
        <TabsContent value={language}>
          <Field label="Επωνυμία στην κεφαλίδα">
            <Input
              disabled={disabled}
              value={data.names?.[language] || ""}
              onChange={(e) => setTranslation("names", e.target.value)}
            />
          </Field>
          <Field label="Περιγραφή εταιρείας & στοιχεία επικοινωνίας">
            <Textarea
              rows={5}
              disabled={disabled}
              value={data.texts?.[language] || ""}
              onChange={(e) => setTranslation("texts", e.target.value)}
            />
          </Field>
          <Field label="Κείμενο παρασκευαστή (παράγεται από)">
            <Textarea
              rows={3}
              disabled={disabled}
              value={data.manufacturer?.[language] || ""}
              onChange={(e) => setTranslation("manufacturer", e.target.value)}
            />
          </Field>
          <Field label="Ειδική εκτροφή / προέλευση επωνυμίας">
            <Textarea
              rows={3}
              disabled={disabled}
              value={data.origins?.[language] || ""}
              onChange={(e) => setTranslation("origins", e.target.value)}
            />
          </Field>
          <p className="mb-5 text-xs text-muted-foreground">
            Αφήστε την ειδική προέλευση κενή για να χρησιμοποιείται η προέλευση
            της σύστασης.
          </p>
        </TabsContent>
      </Tabs>
      <ObjectFields
        data={{ logoAsset: data.logoAsset || "", complete: !!data.complete }}
        disabled={disabled}
        onChange={(d) => onChange({ ...data, ...d })}
      />
      <details className="my-4 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm">
          Στοιχεία καταλόγου & ρυθμίσεις διάταξης
        </summary>
        <div className="mt-4">
          <ObjectFields
            data={Object.fromEntries(
              Object.entries(data).filter(
                ([k]) =>
                  ![
                    ...translated,
                    "name",
                    "logoAsset",
                    "complete",
                    "group",
                  ].includes(k),
              ),
            )}
            disabled={disabled}
            onChange={(d) => onChange({ ...data, ...d })}
          />
        </div>
      </details>
    </>
  );
}
