import { Empty } from "@/components/feedback/empty";
import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Heading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { draftFor } from "@/features/production/production-draft";
import { expiryOf, lotOf } from "@/features/products/product-utils";
import { useRows } from "@/hooks/use-records";
import { api, post } from "@/lib/api";
import { today } from "@/lib/dates";
import { nameOf } from "@/lib/records";
import { type Data, type Preview, type Row } from "@/types/records";
import { Eye, Plus, Printer, Save } from "lucide-react";
import { useState } from "react";

export function Certificates() {
  const records = useRows("certificate"),
    customers = useRows("certificate-customer"),
    products = useRows("product"),
    printers = useRows("printer"),
    vehicles = useRows("vehicle"),
    recipes = useRows("recipe");
  const [savedDate, setSavedDate] = useState("");
  const [edit, setEdit] = useState<Row | null>(null),
    [data, setData] = useState<Data>({
      name: "",
      customerId: "",
      vehicle: "",
      trailer: "",
      shipmentDate: today(),
      templateKey: "certificate-bg",
      languages: ["bg"],
      lines: [],
      notes: "",
    }),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [printer, setPrinter] = useState("");
  function change(d: Data) {
    setData(d);
    setPreview(null);
  }
  return (
    <>
      <Heading title="Πιστοποιητικά" />
      <Notice text={error} />
      <div className="grid items-start gap-5 xl:grid-cols-[1.25fr_1fr]">
        <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card p-5">
          <Field label="Ημερομηνία αποθηκευμένων πιστοποιητικών">
            <Input
              type="date"
              value={savedDate}
              onChange={(e) => setSavedDate(e.target.value)}
            />
          </Field>
          <Field label="Αποθηκευμένο πιστοποιητικό">
            <NativeSelect
              value={edit?.id || ""}
              onChange={(e) => {
                const r = records.rows.find((r) => r.id === e.target.value);
                if (r) {
                  setEdit(r);
                  change(r.data);
                } else {
                  setEdit(null);
                  change({
                    name: "",
                    customerId: "",
                    vehicle: "",
                    trailer: "",
                    shipmentDate: today(),
                    templateKey: "certificate-bg",
                    languages: ["bg"],
                    lines: [],
                    notes: "",
                  });
                }
              }}
            >
              <option value="">Νέο πιστοποιητικό</option>
              {records.rows
                .filter(
                  (r) => !savedDate || r.updatedAt.slice(0, 10) === savedDate,
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.data.shipmentDate} · {nameOf(r)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Περιγραφή">
              <Input
                value={data.name}
                onChange={(e) => change({ ...data, name: e.target.value })}
              />
            </Field>
            <Field label="Τύπος">
              <NativeSelect
                value={data.templateKey}
                onChange={(e) =>
                  change({
                    ...data,
                    templateKey: e.target.value,
                    languages:
                      e.target.value === "certificate-bg" ? ["bg"] : ["en"],
                  })
                }
              >
                <option value="certificate-bg">Βουλγαρίας</option>
                <option value="certificate-conformance">Συμμόρφωσης</option>
              </NativeSelect>
            </Field>
            <Field label="Πελάτης εξωτερικού">
              <NativeSelect
                value={data.customerId}
                onChange={(e) =>
                  change({ ...data, customerId: e.target.value })
                }
              >
                <option value="">Επιλέξτε…</option>
                {customers.rows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nameOf(c)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Ημερομηνία αποστολής">
              <Input
                type="date"
                value={data.shipmentDate}
                onChange={(e) =>
                  change({ ...data, shipmentDate: e.target.value })
                }
              />
            </Field>
            {[
              ["vehicle", "Όχημα"],
              ["trailer", "Ρυμουλκούμενο"],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <Input
                  list={k === "vehicle" ? "certificate-vehicles" : undefined}
                  value={data[k]}
                  onChange={(e) => change({ ...data, [k]: e.target.value })}
                />
              </Field>
            ))}
            <datalist id="certificate-vehicles">
              {vehicles.rows.map((v) => (
                <option key={v.id} value={v.data.name}>
                  {v.key}
                </option>
              ))}
            </datalist>
          </div>
          <h3>Προϊόντα αποστολής</h3>
          {data.lines.map((line: Data, i: number) => (
            <div className="my-4 rounded-lg border p-4" key={i}>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <Field label="Προϊόν">
                  <NativeSelect
                    value={line.productId}
                    onChange={(e) =>
                      change({
                        ...data,
                        lines: data.lines.map((r: Data, n: number) =>
                          n === i
                            ? (() => {
                                const p = products.rows.find(
                                  (p) => p.id === e.target.value,
                                );
                                const d = {
                                  ...draftFor(p || null),
                                  productionDate: r.productionDate,
                                };
                                return {
                                  ...r,
                                  productId: e.target.value,
                                  expiryDate: expiryOf(d),
                                  freezeDate: p?.data.frozen
                                    ? r.productionDate
                                    : null,
                                  lot: lotOf(
                                    d,
                                    p,
                                    recipes.rows.find(
                                      (recipe) =>
                                        recipe.key === p?.data.recipeCode,
                                    ),
                                  ),
                                };
                              })()
                            : r,
                        ),
                      })
                    }
                  >
                    <option value="">Επιλέξτε…</option>
                    {products.rows.map((p) => (
                      <option key={p.id} value={p.id}>
                        {nameOf(p)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {[
                  ["weight", "Καθαρό βάρος (kg)", "number"],
                  ["cartons", "Πλήθος κιβωτίων", "number"],
                  ["lot", "LOT", "text"],
                  ["productionDate", "Παραγωγή", "date"],
                  ["expiryDate", "Λήξη", "date"],
                  ["freezeDate", "Κατάψυξη", "date"],
                ].map(([k, l, type]) => (
                  <Field key={k} label={l}>
                    <Input
                      type={type}
                      step={
                        k === "cartons"
                          ? "1"
                          : type === "number"
                            ? "0.001"
                            : undefined
                      }
                      value={line[k] || ""}
                      onChange={(e) =>
                        change({
                          ...data,
                          lines: data.lines.map((r: Data, n: number) =>
                            n === i
                              ? {
                                  ...r,
                                  [k]:
                                    type === "number"
                                      ? Number(e.target.value)
                                      : e.target.value || null,
                                }
                              : r,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Button
                variant="ghost"
                type="submit"
                className="h-auto gap-1 px-0 py-1 text-xs text-primary"
                onClick={() =>
                  change({
                    ...data,
                    lines: data.lines.filter((_: Data, n: number) => n !== i),
                  })
                }
              >
                Αφαίρεση
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            onClick={() =>
              change({
                ...data,
                lines: [
                  ...data.lines,
                  {
                    productId: "",
                    weight: 0,
                    lot: "",
                    productionDate: today(),
                    expiryDate: today(),
                    freezeDate: null,
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            Προσθήκη προϊόντος
          </Button>
          <Field label="Σημειώσεις">
            <Textarea
              rows={3}
              value={data.notes}
              onChange={(e) => change({ ...data, notes: e.target.value })}
            />
          </Field>
          <div className="my-4 flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              type="submit"
              className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
              onClick={async () => {
                try {
                  const r = await api<Row>(
                    edit ? `/records/${edit.id}` : "/records/certificate",
                    {
                      method: edit ? "PUT" : "POST",
                      body: JSON.stringify({
                        key: edit?.key || crypto.randomUUID(),
                        version: edit?.version || 0,
                        data,
                      }),
                    },
                  );
                  setEdit(r);
                  await records.reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Save size={16} />
              Αποθήκευση
            </Button>
            <Button
              variant="default"
              type="submit"
              className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
              onClick={async () => {
                try {
                  setPreview(await post("/certificates/preview", data));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Eye size={16} />
              Προεπισκόπηση
            </Button>
          </div>
        </section>
        <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card p-5">
          {preview ? (
            <>
              <img
                className="w-full border"
                src={preview.imageUrl}
                alt="Προεπισκόπηση πιστοποιητικού"
              />
              <a href={preview.pdfUrl} target="_blank" rel="noreferrer">
                Άνοιγμα PDF
              </a>
              {(preview.pageCount ?? 1) > 1 && (
                <p className="text-sm text-muted-foreground">
                  Σελίδα 1 από {preview.pageCount}. Ανοίξτε το PDF για όλες τις σελίδες και εκτύπωση.
                </p>
              )}
              {preview.issues.map((i, n) => (
                <Notice key={n} text={i} />
              ))}
            </>
          ) : (
            <Empty>Το πιστοποιητικό θα εμφανιστεί εδώ μετά τον έλεγχο.</Empty>
          )}
          <Field label="Εκτυπωτής Α4">
            <NativeSelect
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
            >
              <option value="">Επιλέξτε…</option>
              {printers.rows
                .filter((p) => p.data.widthMm >= 200)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {nameOf(p)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Button
            variant="default"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold w-full"
            disabled={!preview || preview.issues.length > 0 || !printer || (preview.pageCount ?? 1) > 1}
            onClick={async () => {
              try {
                await post("/jobs", {
                  previewId: preview!.id,
                  printerId: printer,
                  quantity: 1,
                  requestKey: crypto.randomUUID(),
                });
                setPreview(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Printer size={16} />
            Εκτύπωση πιστοποιητικού
          </Button>
        </section>
      </div>
    </>
  );
}
