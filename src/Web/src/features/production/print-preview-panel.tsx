import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ProductionModel } from "@/features/production/use-production";
import { nameOf } from "@/lib/records";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Eye,
  Printer,
  Tags,
} from "lucide-react";
export function PrintPreviewPanel({ model }: { model: ProductionModel }) {
  const {
    availablePrinters,
    preview,
    printer,
    setPrinter,
    quantity,
    setQuantity,
    message,
    canPrint,
    submitPrint,
    selectedTemplate,
  } = model;
  return (
    <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card ">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4 [&_h2]:mb-0 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2]:text-base">
        <h2>Προεπισκόπηση & εκτύπωση</h2>
        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
          {selectedTemplate?.data.widthMm} × {selectedTemplate?.data.heightMm}{" "}
          mm
        </span>
      </div>
      <div className="flex min-h-48 items-center justify-center bg-muted p-6 [&_img]:max-h-[520px] [&_img]:w-full [&_img]:object-contain [&_img]:shadow-md">
        {preview ? (
          <img src={preview.imageUrl} alt="Προεπισκόπηση ετικέτας" />
        ) : (
          <div className="max-w-64 text-center text-muted-foreground [&_svg]:mx-auto [&_svg]:mb-4">
            <Tags size={40} />
            <p>Ελέγξτε την ετικέτα πριν την εκτύπωση.</p>
          </div>
        )}
      </div>
      <div className="p-5">
        {model.formIssue && (
          <p role="status" className="mb-3 text-sm text-amber-800">
            {model.formIssue}
          </p>
        )}
        <Button
          className="mb-4 w-full"
          variant={preview ? "outline" : "default"}
          disabled={model.busy || !!model.formIssue}
          onClick={model.makePreview}
        >
          <Eye size={16} />
          {model.busy ? "Προετοιμασία…" : "Προεπισκόπηση"}
        </Button>
        {preview && (
          <>
            {(preview.pageCount || 1) > 1 && (
              <p className="mb-3 text-sm text-muted-foreground">
                Προεπισκόπηση σελίδας 1 από {preview.pageCount}. Ανοίξτε το PDF
                για προβολή και εκτύπωση όλων των σελίδων.
              </p>
            )}
            <div className="flex justify-between gap-2.5 pb-4 text-xs [&_b]:mt-1 [&_b]:block [&_b]:font-mono [&_b]:text-sm [&_a]:flex [&_a]:items-center [&_a]:gap-1">
              <span>
                LOT <b>{preview.lot || "—"}</b>
              </span>
              <a href={preview.pdfUrl} target="_blank" rel="noreferrer">
                Άνοιγμα PDF <ArrowUpRight size={14} />
              </a>
            </div>
            {preview.issues.length > 0 && (
              <div className="my-3 mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 [&_b]:flex [&_b]:items-center [&_b]:gap-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:leading-loose">
                <b>
                  <AlertTriangle size={17} /> Πριν από την εκτύπωση
                </b>
                <ul>
                  {preview.issues.map((i, n) => (
                    <li key={n}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Εκτυπωτής">
            <NativeSelect
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
            >
              <option value="">Επιλέξτε εκτυπωτή…</option>
              {availablePrinters.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameOf(p)}
                  {!p.data.validated ? " · προς επικύρωση" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Αριθμός αντιτύπων">
            <Input
              type="number"
              min={1}
              max={10000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
        </div>
        {!availablePrinters.length && (
          <p className="mb-3 text-xs text-muted-foreground">
            Δεν έχει ρυθμιστεί εκτυπωτής για αυτή τη διάσταση. Η προεπισκόπηση
            και το PDF παραμένουν διαθέσιμα.
          </p>
        )}
        {!!printer &&
          availablePrinters.some(
            (p) => p.id === printer && !p.data.validated,
          ) && (
            <p className="mb-3 text-xs text-amber-800">
              Ο επιλεγμένος εκτυπωτής χρειάζεται επικύρωση από τον διαχειριστή.
            </p>
          )}
        <Button
          variant="default"
          type="submit"
          className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold w-full"
          disabled={!canPrint}
          onClick={submitPrint}
        >
          <Printer size={17} />
          Αποστολή για εκτύπωση
        </Button>
        {message && (
          <div className="my-4 flex items-center gap-2 text-sm text-emerald-800">
            <Check size={17} />
            {message}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Η υποβολή στην ουρά Windows δεν επιβεβαιώνει τη φυσική εκτύπωση.
        </p>
      </div>
    </section>
  );
}
