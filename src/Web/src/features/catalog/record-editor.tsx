import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BusinessFields } from "@/features/catalog/business-fields";
import { BrandFields } from "./brand-fields";
import { ObjectFields } from "@/features/catalog/object-fields";
import { defaults } from "@/features/catalog/record-defaults";
import { api } from "@/lib/api";
import { nameOf } from "@/lib/records";
import { type Data, type Row } from "@/types/records";
import { Save, X } from "lucide-react";
import { useState } from "react";

export function RecordEditor({
  row,
  kind,
  editable,
  onClose,
  onSaved,
}: {
  row: Row | null;
  kind: string;
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Data>(() =>
      structuredClone({
        ...defaults[kind],
        ...row?.data,
        ...(kind === "brand"
          ? { names: { el: "", en: "", ...row?.data?.names } }
          : {}),
      }),
    ),
    [key, setKey] = useState(row?.key || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-0 right-0 left-auto flex h-dvh w-full max-w-[min(780px,95vw)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-[min(780px,95vw)]"
        aria-label="Επεξεργασία εγγραφής"
      >
        <div className="flex items-center justify-between gap-4 border-b px-6 py-5 [&_h2]:mb-0 [&_h2]:text-lg">
          <div>
            <DialogTitle>{row ? nameOf(row) : "Νέα καταχώρηση"}</DialogTitle>
          </div>
          <Button
            variant="ghost"
            type="button"
            className="size-9 p-2"
            onClick={onClose}
            disabled={busy}
            aria-label="Κλείσιμο"
          >
            <X />
          </Button>
        </div>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(row ? `/records/${row.id}` : `/records/${kind}`, {
                method: row ? "PUT" : "POST",
                body: JSON.stringify({
                  key:
                    kind === "recipe"
                      ? data.code
                      : kind === "reference" && !row
                        ? `${data.group}:${key}`
                        : key,
                  version: row?.version || 0,
                  data,
                }),
              });
              await onSaved();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <Notice text={error} />
            {!["product", "recipe"].includes(kind) && (
              <Field label="Κωδικός">
                <Input
                  required
                  value={key}
                  disabled={!!row || !editable}
                  onChange={(e) => setKey(e.target.value)}
                />
              </Field>
            )}
            {kind === "brand" ? (
              <BrandFields
                data={data}
                onChange={setData}
                disabled={!editable}
              />
            ) : ["product", "recipe", "reference"].includes(kind) ? (
              <BusinessFields
                kind={kind}
                data={data}
                onChange={setData}
                disabled={!editable}
                extra={(d, change) => (
                  <ObjectFields
                    data={d}
                    onChange={change}
                    disabled={!editable}
                  />
                )}
              />
            ) : (
              <ObjectFields
                data={data}
                onChange={setData}
                disabled={!editable}
              />
            )}
          </div>
          <div className="flex justify-end gap-3 border-t px-6 py-4">
            <Button
              variant="outline"
              type="button"
              className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
              onClick={onClose}
              disabled={busy}
            >
              Κλείσιμο
            </Button>
            {editable && (
              <Button
                variant="default"
                type="submit"
                className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
                disabled={busy}
              >
                <Save size={16} />
                Αποθήκευση
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
