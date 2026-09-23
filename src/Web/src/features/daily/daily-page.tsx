import { Empty } from "@/components/feedback/empty";
import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Heading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { draftFor } from "@/features/production/production-draft";
import { defaultWeight } from "@/features/products/product-utils";
import { useRows } from "@/hooks/use-records";
import { post } from "@/lib/api";
import { today } from "@/lib/dates";
import { nameOf } from "@/lib/records";
import { type Preview, type Row } from "@/types/records";
import { ArrowDown, ArrowUp, Eye, Printer, Save } from "lucide-react";
import { useEffect, useState } from "react";

export function Daily() {
  const products = useRows("product"),
    printers = useRows("printer");
  const [date, setDate] = useState(today(1)),
    [order, setOrder] = useState<Row[]>([]),
    [weights, setWeights] = useState<Record<string, number>>({}),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [printer, setPrinter] = useState(""),
    [reviews, setReviews] = useState<
      {
        product: Row;
        preview: Preview;
        quantity: number;
        key: string;
        submitted?: boolean;
      }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () =>
      setOrder(
        products.rows
          .filter((p) => p.data.daily && p.data.active && !p.data.butcher)
          .sort((a, b) => a.data.dailyOrder - b.data.dailyOrder),
      ),
    [products.rows],
  );
  function move(index: number, delta: number) {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setOrder(next);
    setReviews([]);
  }
  return (
    <>
      <Heading title="Καθημερινή παραγωγή" />
      <Notice text={error} />
      <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-4 border-b p-4 sm:px-5 [&>[data-slot=native-select-wrapper]]:w-48">
          <Field label="Ημερομηνία παραγωγής">
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setReviews([]);
              }}
            />
          </Field>
          <Field label="Εκτυπωτής μεγάλων ετικετών">
            <NativeSelect
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
            >
              <option value="">Επιλέξτε…</option>
              {printers.rows
                .filter((p) => p.data.widthMm < 200)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {nameOf(p)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Button
            variant="outline"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            onClick={async () => {
              try {
                await post(
                  "/daily",
                  order.map((p, i) => ({
                    id: p.id,
                    version: p.version,
                    daily: true,
                    order: i,
                  })),
                );
                await products.reload();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Save size={16} />
            Αποθήκευση σειράς
          </Button>
        </div>
        {order.length === 0 ? (
          <Empty>Προσθέστε είδη στην καθημερινή λίστα από τα προϊόντα.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ΣΕΙΡΑ</TableHead>
                <TableHead>ΠΡΟΪΟΝ</TableHead>
                <TableHead>ΒΑΡΟΣ (kg)</TableHead>
                <TableHead>ΑΝΤΙΤΥΠΑ</TableHead>
                <TableHead>ΕΛΕΓΧΟΣ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      type="submit"
                      className="size-9 p-2"
                      disabled={i === 0}
                      aria-label="Πάνω"
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      type="submit"
                      className="size-9 p-2"
                      disabled={i === order.length - 1}
                      aria-label="Κάτω"
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <b>{nameOf(p)}</b>
                    <small>
                      {p.data.erpCode} · {p.data.secondaryCode}
                    </small>
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Βάρος ${nameOf(p)}`}
                      className="quantity w-20"
                      type="number"
                      min="0"
                      step="0.001"
                      value={
                        weights[p.id] ??
                        defaultWeight(p, "Βάρος Προϊόντος") ??
                        ""
                      }
                      onChange={(e) => {
                        setWeights({
                          ...weights,
                          [p.id]: Number(e.target.value),
                        });
                        setReviews([]);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="quantity w-20"
                      type="number"
                      min={0}
                      max={10000}
                      value={quantities[p.id] || 0}
                      onChange={(e) => {
                        setQuantities({
                          ...quantities,
                          [p.id]: Number(e.target.value),
                        });
                        setReviews([]);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {reviews.find((r) => r.product.id === p.id)?.submitted
                      ? "Στην ουρά"
                      : reviews.find((r) => r.product.id === p.id)?.preview
                          .issues.length || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="p-5 my-4 flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              const results: typeof reviews = [];
              try {
                for (const p of order.filter(
                  (p) => (quantities[p.id] || 0) > 0,
                )) {
                  const draft = {
                    ...draftFor(p),
                    productionDate: date,
                    weight:
                      weights[p.id] ?? defaultWeight(p, "Βάρος Προϊόντος"),
                    freezeDate: p.data.frozen ? date : null,
                  };
                  const preview = await post<Preview>("/preview", draft);
                  results.push({
                    product: p,
                    preview,
                    quantity: quantities[p.id],
                    key: crypto.randomUUID(),
                  });
                }
                setReviews(results);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Eye size={17} />
            Έλεγχος παρτίδας
          </Button>
          <Button
            variant="default"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            disabled={
              busy ||
              !printer ||
              !reviews.length ||
              reviews.some((r) => r.preview.issues.length > 0) ||
              reviews.every((r) => r.submitted)
            }
            onClick={async () => {
              setBusy(true);
              try {
                for (const review of reviews.filter((r) => !r.submitted)) {
                  await post("/jobs", {
                    previewId: review.preview.id,
                    printerId: printer,
                    quantity: review.quantity,
                    requestKey: review.key,
                  });
                  review.submitted = true;
                  setReviews([...reviews]);
                }
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Printer size={17} />
            Εκτύπωση παρτίδας
          </Button>
        </div>
        {reviews.map((r) => (
          <div
            className="border-t px-6 py-4 [&_p]:text-xs [&_p]:text-amber-800"
            key={r.product.id}
          >
            <a href={r.preview.pdfUrl} target="_blank" rel="noreferrer">
              {nameOf(r.product)} · {r.quantity} αντίτυπα
            </a>
            {r.preview.issues.map((i, n) => (
              <p key={n}>{i}</p>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
