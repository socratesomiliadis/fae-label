import { Field } from "@/components/forms/field";
import { LanguageTabs } from "@/components/forms/language-tabs";
import { RecordField } from "./record-field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  BusinessFieldsModel,
  BusinessFieldsProps,
} from "./use-business-fields";
const nutrients = [
  "Ενέργεια",
  "Λιπαρά",
  "Κορεσμένα",
  "Υδατάνθρακες",
  "Σάκχαρα",
  "Εδώδιμες Ίνες",
  "Πρωτεϊνες",
  "Αλάτι",
];
export function RecipeFields({
  model,
  data,
  onChange,
  disabled,
  extra,
}: BusinessFieldsProps & { model: BusinessFieldsModel }) {
  const { language, error, set, refs, languageKeys, languageRows } = model;
  const translation = data.translations?.[language] || {};
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
          name="code"
          label="Κωδικός σύστασης"
          required
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="name"
          label="Περιγραφή"
          required
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="family"
          label="Οικογένεια"
          options={refs("family")}
          prefix="family:"
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="category"
          label="Κατηγορία"
          options={refs("category")}
          prefix="category:"
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
        <RecordField
          name="originKey"
          label="Εκτροφή / προέλευση"
          options={refs("origin")}
          prefix="origin:"
          data={data}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
      <LanguageTabs languages={languageKeys} rows={languageRows} />
      <TabsContent value={language}>
        {[
          ["ingredients", "Συστατικά"],
          ["allergens", "Αλλεργιογόνα"],
          ["nutrition", "Διατροφικό κείμενο"],
        ].map(([k, label]) => (
          <Field key={k} label={label}>
            <Textarea
              rows={k === "ingredients" ? 4 : 2}
              disabled={disabled}
              value={translation[k] || ""}
              onChange={(e) =>
                set("translations", {
                  ...data.translations,
                  [language]: {
                    ...translation,
                    [k]: e.target.value,
                    ...(k === "ingredients" ? { runs: null } : {}),
                  },
                })
              }
            />
          </Field>
        ))}
      </TabsContent>
      <h3>Διατροφικά στοιχεία</h3>
      <Table className="mb-5 [&_td]:px-2 [&_td]:py-1 [&_input]:h-8">
        <TableHeader>
          <TableRow>
            <TableHead>Συστατικό</TableHead>
            <TableHead>ανά 100 g</TableHead>
            <TableHead>% ΠΠΑ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nutrients.map((n) => (
            <TableRow key={n}>
              <TableCell>{n}</TableCell>
              {[" ανά 100gr", " %ΠΠΑ"].map((suffix) => (
                <TableCell key={suffix}>
                  <Input
                    aria-label={n + suffix}
                    disabled={disabled}
                    value={data.nutrition?.[n + suffix] || ""}
                    onChange={(e) =>
                      set("nutrition", {
                        ...data.nutrition,
                        [n + suffix]: e.target.value,
                      })
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {extra({ specificationAsset: data.specificationAsset || "" }, (d) =>
        onChange({ ...data, ...d }),
      )}
      <details className="col-span-full my-2 mb-4 rounded-lg border p-3 [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:justify-between [&>summary]:py-1 [&>summary]:text-sm [&>summary]:text-muted-foreground [&[open]>summary]:mb-4">
        <summary>Πρόσθετα διατροφικά πεδία</summary>
        {extra(
          {
            nutrition: Object.fromEntries(
              Object.entries(data.nutrition || {}).filter(
                ([k]) =>
                  !nutrients.some(
                    (n) => k === n + " ανά 100gr" || k === n + " %ΠΠΑ",
                  ),
              ),
            ),
          },
          (d) => set("nutrition", { ...data.nutrition, ...d.nutrition }),
        )}
      </details>
    </>
  );
}
