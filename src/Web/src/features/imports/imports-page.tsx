import { Notice } from "@/components/feedback/notice";
import { Heading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, post } from "@/lib/api";
import { type Data } from "@/types/records";
import { Check, Save, Search, Upload } from "lucide-react";
import { useState } from "react";

export function Imports({ admin }: { admin: boolean }) {
  const [products, setProducts] = useState<File | null>(null),
    [recipes, setRecipes] = useState<File | null>(null),
    [review, setReview] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <>
      <Heading title="Από το Excel στο εργαστήριο." />
      {!admin ? (
        <Notice text="Η εισαγωγή δεδομένων είναι διαθέσιμη μόνο σε διαχειριστές." />
      ) : (
        <>
          <Notice text={error} />
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ["Προϊόντα", "PROIONTA.xlsx", setProducts, products],
              ["Συστάσεις", "SYNTAGES.xlsx", setRecipes, recipes],
            ].map(([title, file, set, value]) => (
              <label
                className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed bg-card p-10 [&_input]:sr-only [&_h2]:mt-5 [&_p]:mb-5 [&_p]:text-sm focus-within:ring-2 focus-within:ring-ring"
                key={String(title)}
              >
                <div className="grid size-16 place-items-center rounded-full bg-secondary text-primary">
                  <Upload size={25} />
                </div>
                <h2>{String(title)}</h2>
                <p>{(value as File)?.name || String(file)}</p>
                <Input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    (set as (f: File | null) => void)(
                      e.target.files?.[0] || null,
                    );
                    setReview(null);
                    setDone(false);
                  }}
                />
                <span className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold">
                  Επιλογή αρχείου
                </span>
              </label>
            ))}
          </div>
          <div className="my-4 flex flex-wrap justify-end gap-3">
            <Button
              variant="default"
              type="submit"
              className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
              disabled={busy || (!products && !recipes)}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const form = new FormData();
                  if (recipes) form.append("recipe", recipes);
                  if (products) form.append("product", products);
                  setReview(
                    await api("/imports", { method: "POST", body: form }),
                  );
                  setDone(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Search size={17} />
              Έλεγχος εισαγωγής
            </Button>
          </div>
          {review && (
            <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between gap-4 border-b px-5 py-4 [&_h2]:mb-0 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2]:text-base">
                <div>
                  <h2>
                    {review.products} προϊόντα · {review.recipes} συστάσεις
                  </h2>
                  <p>
                    {review.issues.length} σημεία προς έλεγχο. Οι
                    προειδοποιήσεις εμποδίζουν τις επηρεαζόμενες εκτυπώσεις, όχι
                    την αποθήκευση.
                  </p>
                </div>
                <Button
                  variant="default"
                  type="submit"
                  className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
                  disabled={
                    busy ||
                    done ||
                    review.issues.some((i: Data) => i.severity === "error")
                  }
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await post(`/imports/${review.id}/commit`, {});
                      setDone(true);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {done ? <Check size={17} /> : <Save size={17} />}{" "}
                  {done ? "Ολοκληρώθηκε" : "Επιβεβαίωση εισαγωγής"}
                </Button>
              </div>
              <div className="max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ΤΥΠΟΣ</TableHead>
                      <TableHead>ΓΡΑΜΜΗ</TableHead>
                      <TableHead>ΚΩΔΙΚΟΣ</TableHead>
                      <TableHead>ΕΛΕΓΧΟΣ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {review.issues.map((i: Data, n: number) => (
                      <TableRow key={n}>
                        <TableCell>
                          {i.severity === "error" ? "Σφάλμα" : "Προειδοποίηση"}
                        </TableCell>
                        <TableCell>{i.row}</TableCell>
                        <TableCell>{i.key}</TableCell>
                        <TableCell>{i.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
