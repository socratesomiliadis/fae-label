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
  const [draft, setDraft] = useState<Data>(() => ({
      ...draftFor(initial?.kind === "product" ? initial : null),
      templateKey:
        initial?.kind === "customer"
          ? "address-small"
          : (
              {
                sample: "sample-small",
                custom: "custom-small",
                butcher: "butcher-small",
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
    [productSearch, setProductSearch] = useState(""),
    [scope, setScope] = useState(workflow === "butcher" ? "butcher" : "active");
  const draftRevision = useRef(0);
  const change = (next: Data) => {
    draftRevision.current += 1;
    setDraft(next);
    setPreview(null);
    setMessage("");
  };
  const set = (key: string, value: unknown) =>
    change({ ...draft, [key]: value });
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
    setPrinter(printers.rows.find((p) => p.key === key)?.id || "");
  }, [printerProfile, printers.rows]);
  const productNeeded =
    ["thermal", "pallet", "sample", "butcher"].includes(
      selectedTemplate?.data.family,
    ) && draft.mode !== "blank";
  async function makePreview() {
    const revision = draftRevision.current;
    setBusy(true);
    setError("");
    try {
      const result = await post<Preview>("/preview", draft);
      if (revision === draftRevision.current) setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
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
      setSavedDraft(result);
      setMessage("Η προετοιμασία αποθηκεύτηκε.");
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
    !!printer &&
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
    scope,
    setScope,
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
