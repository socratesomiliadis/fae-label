import {
  compatiblePrinters,
  productionInputIssue,
  labelOptions,
  matchesOption,
  needsProduct,
  normalizeDraft,
} from "./label-options";
import { draftFor } from "@/features/production/production-draft";
import { useRows } from "@/hooks/use-records";
import { api, post } from "@/lib/api";
import { nameOf } from "@/lib/records";
import { type Data, type Preview, type Row } from "@/types/records";
import { useEffect, useRef, useState } from "react";
export function useProduction({
  initial,
  workflow = "production",
}: {
  initial: Row | null;
  workflow?: string;
}) {
  const products = useRows("product"),
    templates = useRows("template"),
    brands = useRows("brand"),
    printers = useRows("printer"),
    languages = useRows("language"),
    customers = useRows("customer"),
    drafts = useRows("draft"),
    recipes = useRows("recipe"),
    references = useRows("reference");
  const [rawDraft, setDraft] = useState<Data>(() => ({
      ...draftFor(initial?.kind === "product" ? initial : null),
      templateKey:
        initial?.kind === "customer"
          ? "address-small"
          : initial?.data.butcher
            ? "butcher-a4"
            : (
                {
                  sample: "sample-small",
                  custom: "custom-small",
                  butcher: "butcher-a4",
                  "production-label": "production-small",
                } as Record<string, string>
              )[workflow] || "thermal-large",
      languages:
        workflow === "production" && initial?.kind !== "customer"
          ? ["el", "en"]
          : ["el"],
      customerId: initial?.kind === "customer" ? initial.id : null,
    })),
    [preview, setPreview] = useState<Preview | null>(null),
    [printer, setPrinter] = useState(""),
    [quantity, setQuantity] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [savedDraft, setSavedDraft] = useState<Row | null>(null),
    [productSearch, setProductSearch] = useState("");
  const draft = normalizeDraft(
    rawDraft,
    templates.rows,
    brands.rows,
    languages.rows,
    products.rows,
  );
  const draftRevision = useRef(0);
  const change = (next: Data) => {
    draftRevision.current += 1;
    setDraft(
      normalizeDraft(
        next,
        templates.rows,
        brands.rows,
        languages.rows,
        products.rows,
      ),
    );
    setPreview(null);
    setMessage("");
    setError("");
  };
  const set = (key: string, value: unknown) =>
    change({
      ...draft,
      ...(key === "productionDate" && draft.freezeDate === draft.productionDate
        ? { freezeDate: value }
        : {}),
      [key]: value,
    });
  const selected = products.rows.find((p) => p.id === draft.productId);
  const selectedTemplate = templates.rows.find(
    (t) => t.key === draft.templateKey,
  );
  const printerProfile = selectedTemplate?.data.profile;
  useEffect(() => {
    const key =
      printerProfile === "a4"
        ? "kyocera-a4"
        : printerProfile === "small"
          ? "zebra-small"
          : "zebra-large";
    const compatible = compatiblePrinters(selectedTemplate, printers.rows);
    setPrinter(
      compatible.find((p) => p.key === key)?.id || compatible[0]?.id || "",
    );
  }, [printerProfile, selectedTemplate, printers.rows]);
  const productNeeded = needsProduct(selectedTemplate, draft.mode);
  const options = selectedTemplate
    ? labelOptions(
        selectedTemplate,
        brands.rows.find((b) => b.key === draft.brandKey),
        languages.rows,
      )
    : [];
  const outputValid = options.some((o) => matchesOption(draft, o));
  const availablePrinters = compatiblePrinters(selectedTemplate, printers.rows);
  const formIssue = !selectedTemplate
    ? "Φόρτωση μορφών ετικέτας…"
    : !outputValid
      ? "Δεν υπάρχει αυτή η μορφή για την επιλεγμένη επωνυμία. Επιλέξτε άλλη μορφή ή επωνυμία."
      : productNeeded && !selected
        ? "Επιλέξτε προϊόν για την ετικέτα."
        : productNeeded && !selected?.data.active
          ? "Το προϊόν είναι ανενεργό. Ενεργοποιήστε το από τα στοιχεία προϊόντος."
          : selectedTemplate.data.family === "address" && !draft.customerId
            ? "Επιλέξτε πελάτη."
            : ["custom", "production"].includes(selectedTemplate.data.family) &&
                !draft.freeText?.trim()
              ? "Συμπληρώστε το κείμενο της ετικέτας."
              : productionInputIssue(draft, productNeeded);
  const payload = () => ({
    ...draft,
    productId: productNeeded ? draft.productId : null,
    ...(!productNeeded
      ? {
          shelfLife: 0,
          weight: null,
          cartonWeight: null,
          palletWeight: null,
          pieces: null,
          animalCode: "",
          slaughterhouse: "",
          supplier: "",
        }
      : {}),
    customerId: ["address", "sample"].includes(selectedTemplate?.data.family)
      ? draft.customerId
      : null,
    freezeDate:
      productNeeded && selected?.data.frozen ? draft.freezeDate : null,
    packagingDate: productNeeded ? draft.packagingDate : null,
    expiryOverride: productNeeded ? draft.expiryOverride : null,
  });
  // Master-data edits invalidate a preview just as production edits do.
  useEffect(() => {
    draftRevision.current += 1;
    setPreview(null);
  }, [
    products.rows,
    templates.rows,
    brands.rows,
    recipes.rows,
    references.rows,
    languages.rows,
    customers.rows,
  ]);
  async function makePreview() {
    if (formIssue) {
      setError(formIssue);
      return;
    }
    const revision = draftRevision.current;
    setBusy(true);
    setError("");
    try {
      const result = await post<Preview>("/preview", payload());
      if (revision === draftRevision.current) setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (formIssue) {
      setError(formIssue);
      return;
    }
    const revision = draftRevision.current;
    setBusy(true);
    setError("");
    try {
      const result = await api<Row>(
        savedDraft ? `/records/${savedDraft.id}` : "/records/draft",
        {
          method: savedDraft ? "PUT" : "POST",
          body: JSON.stringify({
            key: savedDraft?.key || crypto.randomUUID(),
            version: savedDraft?.version || 0,
            data: {
              ...draft,
              name:
                draft.name ||
                `${draft.productionDate} · ${selected ? nameOf(selected) : "Ετικέτα"}`,
            },
          }),
        },
      );
      if (revision === draftRevision.current) {
        setSavedDraft(result);
        setMessage("Η προετοιμασία αποθηκεύτηκε.");
      }
      await drafts.reload();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canPrint =
    !!preview &&
    preview.issues.length === 0 &&
    (preview.pageCount || 1) === 1 &&
    availablePrinters.some((p) => p.id === printer && p.data.validated) &&
    !formIssue &&
    !busy &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 10000;
  async function submitPrint() {
    if (!canPrint || !preview) return;
    setBusy(true);
    setError("");
    try {
      await post("/jobs", {
        previewId: preview.id,
        printerId: printer,
        quantity,
        requestKey: crypto.randomUUID(),
      });
      setMessage("Η εργασία προστέθηκε στην ουρά εκτύπωσης.");
      setPreview(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    availablePrinters,
    formIssue,
    options,
    products,
    templates,
    brands,
    printers,
    languages,
    customers,
    drafts,
    recipes,
    references,
    draft,
    preview,
    setPreview,
    printer,
    setPrinter,
    quantity,
    setQuantity,
    error,
    setError,
    busy,
    setBusy,
    message,
    setMessage,
    savedDraft,
    setSavedDraft,
    productSearch,
    setProductSearch,
    change,
    set,
    selected,
    selectedTemplate,
    productNeeded,
    makePreview,
    saveDraft,
    canPrint,
    submitPrint,
  };
}
export type ProductionModel = ReturnType<typeof useProduction>;
