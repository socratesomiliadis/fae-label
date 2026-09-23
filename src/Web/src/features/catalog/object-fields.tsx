import { Field } from "@/components/forms/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { labels } from "@/features/catalog/field-labels";
import { api } from "@/lib/api";
import { type Data } from "@/types/records";
import { Plus } from "lucide-react";

export function ObjectFields({
  data,
  onChange,
  disabled = false,
  path = "",
}: {
  data: Data;
  onChange: (d: Data) => void;
  disabled?: boolean;
  path?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      {Object.entries(data)
        .filter(([k]) => !["legacyProduction", "runs", "expiry"].includes(k))
        .map(([k, v]) => {
          const label = k === "names" && data.group === "brand" ? "Επωνυμία ανά γλώσσα" : labels[k] || k;
          if (v !== null && typeof v === "object" && !Array.isArray(v))
            return (
              <details
                key={k}
                className="col-span-full my-2 mb-4 rounded-lg border p-3 [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:justify-between [&>summary]:py-1 [&>summary]:text-sm [&>summary]:text-muted-foreground [&[open]>summary]:mb-4"
                open={Object.keys(v).length < 5}
              >
                <summary>
                  {label}
                  <small>{Object.keys(v).length} πεδία</small>
                </summary>
                <ObjectFields
                  data={v}
                  onChange={(next) => onChange({ ...data, [k]: next })}
                  disabled={disabled}
                  path={path + "." + k}
                />
                {!disabled && (
                  <Button
                    variant="ghost"
                    type="button"
                    className="h-auto gap-1 px-0 py-1 text-xs text-primary"
                    onClick={() => {
                      const key = prompt("Κωδικός νέου πεδίου / γλώσσας");
                      if (key && !Object.hasOwn(v, key))
                        onChange({
                          ...data,
                          [k]: {
                            ...v,
                            [key]:
                              k === "translations"
                                ? {
                                    ingredients: "",
                                    allergens: "",
                                    nutrition: "",
                                  }
                                : "",
                          },
                        });
                    }}
                  >
                    <Plus size={14} />
                    Προσθήκη πεδίου
                  </Button>
                )}
              </details>
            );
          if (typeof v === "boolean")
            return (
              <label
                className="mb-3 flex items-center gap-2.5 py-2.5 text-sm [&_input]:size-4 [&_input]:min-h-0 [&_input]:accent-primary"
                key={k}
              >
                <Checkbox
                  checked={v}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange({ ...data, [k]: checked })
                  }
                />
                {label}
              </label>
            );
          if (k.toLowerCase().endsWith("asset"))
            return (
              <div
                className="mb-4 flex min-w-0 flex-col gap-2 [&>span]:text-xs [&>span]:font-medium [&>span]:text-muted-foreground"
                key={k}
              >
                <span>{label}</span>
                <Input
                  value={String(v || "")}
                  disabled={disabled}
                  placeholder="Χωρίς αρχείο"
                  onChange={(e) => onChange({ ...data, [k]: e.target.value })}
                />
                {v && (
                  <a href={`/api/assets/${v}`} target="_blank" rel="noreferrer">
                    Προβολή αρχείου
                  </a>
                )}
                {!disabled && (
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={async (e) => {
                      if (!e.target.files?.[0]) return;
                      const f = new FormData();
                      f.append("file", e.target.files[0]);
                      try {
                        const r = await api("/assets", {
                          method: "POST",
                          body: f,
                        });
                        onChange({ ...data, [k]: r.hash });
                      } catch (err) {
                        alert((err as Error).message);
                      }
                    }}
                  />
                )}
              </div>
            );
          const isLong =
            typeof v === "string" &&
            (v.length > 90 ||
              [
                "ingredients",
                "allergens",
                "nutrition",
                "validationNote",
                "address",
              ].includes(k) ||
              path.includes("texts") ||
              path.includes("headings"));
          return (
            <Field label={label} key={k}>
              {isLong ? (
                <Textarea
                  rows={3}
                  value={String(v || "")}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...data, [k]: e.target.value })}
                />
              ) : (
                <Input
                  type={typeof v === "number" ? "number" : "text"}
                  value={Array.isArray(v) ? v.join(", ") : (v ?? "")}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      [k]: Array.isArray(v)
                        ? e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean)
                        : typeof v === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </Field>
          );
        })}
    </div>
  );
}
