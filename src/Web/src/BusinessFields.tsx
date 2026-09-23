import {
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { api, nameOf, type Row, type Data } from "./api";
import { productLists, groupNames } from "./product";

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id: string }>, { id })
        : children}
    </div>
  );
}
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
export function BusinessFields({
  kind,
  data,
  onChange,
  disabled,
  extra,
}: {
  kind: string;
  data: Data;
  onChange: (d: Data) => void;
  disabled: boolean;
  extra: (d: Data, change: (d: Data) => void) => ReactNode;
}) {
  const [lookups, setLookups] = useState<Record<string, Row[]>>({});
  const [language, setLanguage] = useState("el");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const kinds = ["reference", "recipe", "brand", "language"];
    Promise.all(
      kinds.map(async (k) => [k, await api<Row[]>(`/records/${k}`)] as const),
    )
      .then((values) => {
        if (active) setLookups(Object.fromEntries(values));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const refs = (group: string) =>
    (lookups.reference || []).filter((r) => r.data.group === group);
  const options = (value: string, rows: Row[], prefix = "") => (
    <>
      <option value="">Επιλέξτε…</option>
      {value && !rows.some((r) => r.key.replace(prefix, "") === value) && (
        <option value={value}>{value}</option>
      )}
      {rows.map((r) => (
        <option key={r.id} value={r.key.replace(prefix, "")}>
          {r.key.replace(prefix, "")} · {nameOf(r)}
        </option>
      ))}
    </>
  );
  const select = (k: string, label: string, rows: Row[], prefix = "") => (
    <Field key={k} label={label}>
      <select
        disabled={disabled}
        value={data[k] || ""}
        onChange={(e) => set(k, e.target.value)}
      >
        {options(data[k], rows, prefix)}
      </select>
    </Field>
  );
  const text = (k: string, label: string, required = false) => (
    <Field key={k} label={label}>
      <input
        disabled={disabled}
        required={required}
        value={data[k] || ""}
        onChange={(e) => set(k, e.target.value)}
      />
    </Field>
  );
  const languageRows = lookups.language || [];
  const languageKeys = [
    ...new Set([
      "el",
      ...languageRows.map((r) => r.key),
      ...Object.keys(data.names || data.translations || {}),
    ]),
  ];
  const tabs = (
    <div className="tabs language-tabs" role="tablist" aria-label="Γλώσσες">
      {languageKeys.map((key) => (
        <button
          type="button"
          role="tab"
          aria-selected={language === key}
          className={language === key ? "active" : ""}
          onClick={() => setLanguage(key)}
          key={key}
        >
          {languageRows.find((r) => r.key === key)?.data.name ||
            key.toUpperCase()}
        </button>
      ))}
    </div>
  );
  if (kind === "reference")
    return (
      <>
        <div className="form-grid">
          {text("name", "Περιγραφή", true)}
          <Field label="Λίστα">
            <select
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
            </select>
          </Field>
        </div>
        {data.group === "condition" && (
          <label className="check-field">
            <input
              type="checkbox"
              disabled={disabled}
              checked={!!data.frozen}
              onChange={(e) => set("frozen", e.target.checked)}
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
  if (kind === "product")
    return (
      <>
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        <div className="form-grid">
          {text("erpCode", "Κωδικός ERP", true)}
          {text("secondaryCode", "Δευτερεύων κωδικός")}
          {text("barcode", "Barcode προϊόντος", true)}
          {text("cartonBarcode", "Barcode κιβωτίου", true)}
          {select("recipeCode", "Σύσταση", lookups.recipe || [])}
          <Field label="Ημέρες λήξης">
            <input
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
            <select
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
            </select>
          </Field>
          <Field label="Βάρος μικρής ετικέτας">
            <select
              disabled={disabled}
              value={data.smallLabelWeight || "product"}
              onChange={(e) => set("smallLabelWeight", e.target.value)}
            >
              <option value="product">Προϊόντος</option>
              <option value="carton">Κιβωτίου</option>
            </select>
          </Field>
        </div>
        <div className="button-row">
          {[
            ["active", "Ενεργό"],
            ["daily", "Καθημερινό"],
            ["butcher", "Κρεοπωλείου"],
          ].map(([k, label]) => (
            <label className="check-field" key={k}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!data[k]}
                onChange={(e) => set(k, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <h3>Επωνυμίες</h3>
        <div className="brand-options">
          {(lookups.brand || []).map((b) => (
            <label className="check-field" key={b.id}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={(data.brands || []).includes(b.key)}
                onChange={(e) =>
                  set(
                    "brands",
                    e.target.checked
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
        {tabs}
        <Field label={`Περιγραφή (${language.toUpperCase()})`}>
          <textarea
            rows={2}
            disabled={disabled}
            required={language === "el"}
            value={data.names?.[language] || ""}
            onChange={(e) =>
              set("names", { ...data.names, [language]: e.target.value })
            }
          />
        </Field>
        <h3>Στοιχεία προϊόντος</h3>
        <div className="form-grid">
          {productLists.map(([field, group]) => (
            <Field key={field} label={field}>
              <select
                disabled={disabled}
                value={data.fields?.[field] || ""}
                onChange={(e) =>
                  set("fields", { ...data.fields, [field]: e.target.value })
                }
              >
                {options(data.fields?.[field], refs(group), group + ":")}
              </select>
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
              <input
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
  const translation = data.translations?.[language] || {};
  return (
    <>
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      <div className="form-grid">
        {text("code", "Κωδικός σύστασης", true)}
        {text("name", "Περιγραφή", true)}
        {select("family", "Οικογένεια", refs("family"), "family:")}
        {select("category", "Κατηγορία", refs("category"), "category:")}
        {select("originKey", "Εκτροφή / προέλευση", refs("origin"), "origin:")}
      </div>
      {tabs}
      {[
        ["ingredients", "Συστατικά"],
        ["allergens", "Αλλεργιογόνα"],
        ["nutrition", "Διατροφικό κείμενο"],
      ].map(([k, label]) => (
        <Field key={k} label={label}>
          <textarea
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
      <h3>Διατροφικά στοιχεία</h3>
      <table className="nutrition-table">
        <thead>
          <tr>
            <th>Συστατικό</th>
            <th>ανά 100 g</th>
            <th>% ΠΠΑ</th>
          </tr>
        </thead>
        <tbody>
          {nutrients.map((n) => (
            <tr key={n}>
              <td>{n}</td>
              {[" ανά 100gr", " %ΠΠΑ"].map((suffix) => (
                <td key={suffix}>
                  <input
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
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {extra({ specificationAsset: data.specificationAsset || "" }, (d) =>
        onChange({ ...data, ...d }),
      )}
      <details className="field-group">
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
