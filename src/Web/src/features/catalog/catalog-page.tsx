import { menus } from "@/app/navigation";
import { Busy } from "@/components/feedback/busy";
import { Empty } from "@/components/feedback/empty";
import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Heading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import { RecordEditor } from "@/features/catalog/record-editor";
import { filterCatalog } from "@/features/catalog/catalog-filters";
import { groupNames, productValue } from "@/features/products/product-utils";
import { useRows } from "@/hooks/use-records";
import { nameOf } from "@/lib/records";
import { type Row } from "@/types/records";
import { ChevronRight, Plus, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function Catalog({
  kind,
  admin,
  onPrint,
  labelMode = false,
}: {
  kind: string;
  admin: boolean;
  onPrint: (r: Row) => void;
  labelMode?: boolean;
}) {
  const { rows, error, loading, reload } = useRows(kind),
    recipes = useRows(kind === "product" ? "recipe" : ""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState<Row | null>(null),
    [create, setCreate] = useState(false),
    [filter, setFilter] = useState(labelMode ? "active" : "all");
  useEffect(() => {
    setSearch("");
    setEdit(null);
    setCreate(false);
    setFilter(labelMode ? "active" : "all");
    setFilters({});
  }, [kind, labelMode]);
  const filtered = useMemo(
    () =>
      filterCatalog(rows, {
        search,
        filter,
        fields: filters,
        kind,
        recipes: recipes.rows,
        labelMode,
      }),
    [rows, search, filter, filters, kind, recipes.rows, labelMode],
  );
  const title =
    menus.find((m) => m[0] === kind)?.[1] ||
    (
      {
        reference: "Λίστες",
        language: "Γλώσσες",
        printer: "Εκτυπωτές",
        vehicle: "Οχήματα",
        "certificate-customer": "Πελάτες εξωτερικού",
      } as Record<string, string>
    )[kind] ||
    kind;
  const canEdit = !labelMode && (admin || kind === "customer");
  return (
    <>
      <Heading title={labelMode ? "Έκδοση ετικετών" : title}>
        {canEdit && (
          <Button
            variant="default"
            type="submit"
            className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
            onClick={() => setCreate(true)}
          >
            <Plus size={17} />
            Νέα εγγραφή
          </Button>
        )}
      </Heading>
      <Notice text={error} />
      <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-4 border-b p-4 sm:px-5 [&>[data-slot=native-select-wrapper]]:w-48">
          <div className="relative min-w-40 max-w-md flex-1 [&_svg]:absolute [&_svg]:top-3 [&_svg]:left-3 [&_svg]:text-muted-foreground [&_input]:bg-muted/40 [&_input]:pl-10">
            <Search size={18} />
            <Input
              placeholder="Αναζήτηση με περιγραφή ή κωδικό…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {kind === "product" && (
            <NativeSelect
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {!labelMode && <option value="all">Όλα τα προϊόντα</option>}
              <option value="active">Ενεργά</option>
              <option value="daily">Καθημερινά</option>
              {!labelMode && <option value="inactive">Ανενεργά</option>}
              <option value="private">Private label</option>
              <option value="butcher">Κρεοπωλείου</option>
            </NativeSelect>
          )}
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
            {filtered.length} εγγραφές
          </span>
        </div>
        {["product", "recipe", "customer", "reference"].includes(kind) && (
          <div className="flex flex-wrap gap-3 border-b bg-muted/30 px-5 py-3 [&>div]:mb-0 [&>div]:flex-[1_1_130px]">
            {(kind === "product"
              ? [
                  ["Συντομογραφία", "Συντομογραφία"],
                  ["family", "Οικογένεια"],
                  ["Τμήμα Παραγωγής", "Τμήμα παραγωγής"],
                  ["condition", "Κατάσταση"],
                  ["Συσκευασία Προϊόντος", "Συσκευασία"],
                ]
              : kind === "recipe"
                ? [
                    ["category", "Κατηγορία"],
                    ["family", "Οικογένεια"],
                  ]
                : kind === "reference"
                  ? [["group", "Λίστα"]]
                  : [
                      ["city", "Πόλη"],
                      ["country", "Χώρα"],
                    ]
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <NativeSelect
                  value={filters[key] || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.value })
                  }
                >
                  <option value="">Όλες</option>
                  {[
                    ...new Set(
                      rows
                        .map((r) =>
                          kind === "product"
                            ? productValue(r, key, recipes.rows)
                            : String(r.data[key] || ""),
                        )
                        .filter(Boolean),
                    ),
                  ]
                    .sort((a, b) => a.localeCompare(b, "el"))
                    .map((value) => (
                      <option key={value} value={value}>
                        {key === "group" ? groupNames[value] || value : value}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            ))}
            {Object.values(filters).some(Boolean) && (
              <Button
                variant="ghost"
                type="submit"
                className="h-auto gap-1 px-0 py-1 text-xs text-primary"
                onClick={() => setFilters({})}
              >
                Καθαρισμός
              </Button>
            )}
          </div>
        )}
        {loading ? (
          <Busy />
        ) : filtered.length === 0 ? (
          <Empty>Δεν βρέθηκαν εγγραφές.</Empty>
        ) : (
          <div className="max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ΚΩΔΙΚΟΣ</TableHead>
                  <TableHead>ΠΕΡΙΓΡΑΦΗ</TableHead>
                  <TableHead>
                    {kind === "product" ? "ΣΥΣΤΑΣΗ" : "ΣΤΟΙΧΕΙΑ"}
                  </TableHead>
                  <TableHead>ΚΑΤΑΣΤΑΣΗ</TableHead>
                  {kind === "product" && (
                    <>
                      <TableHead>ΟΙΚΟΓΕΝΕΙΑ</TableHead>
                      <TableHead>ΣΥΣΚΕΥΑΣΙΑ</TableHead>
                    </>
                  )}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.data.erpCode || r.key}
                      {r.data.secondaryCode && (
                        <small>
                          {r.data.secondaryCode} · #{r.key}
                        </small>
                      )}
                    </TableCell>
                    <TableCell>
                      <b>{nameOf(r)}</b>
                      {kind === "template" && (
                        <small>
                          {r.data.widthMm} × {r.data.heightMm} mm ·{" "}
                          {r.data.profile}
                        </small>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.data.recipeCode ||
                        r.data.family ||
                        r.data.group ||
                        r.data.city ||
                        "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-auto py-1",
                          r.data.active || r.data.complete || r.data.validated
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {kind === "product"
                          ? r.data.active
                            ? "Ενεργό"
                            : "Ανενεργό"
                          : kind === "template"
                            ? r.data.validated
                              ? "Επικυρωμένο"
                              : "Προς επικύρωση"
                            : r.data.complete === false
                              ? "Προς συμπλήρωση"
                              : "Καταχωρημένο"}
                      </Badge>
                      {kind === "product" && r.data.daily && (
                        <small>Καθημερινό</small>
                      )}
                    </TableCell>
                    {kind === "product" && (
                      <>
                        <TableCell>
                          {productValue(r, "family", recipes.rows)}
                          <small>{productValue(r, "condition")}</small>
                        </TableCell>
                        <TableCell>
                          {productValue(r, "Συσκευασία Προϊόντος")}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        {!labelMode &&
                          ["product", "customer"].includes(kind) && (
                            <Button
                              variant="ghost"
                              type="submit"
                              className="size-9 p-2"
                              title="Έκδοση ετικέτας"
                              onClick={() => onPrint(r)}
                            >
                              <Printer size={17} />
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          type="submit"
                          className="h-auto gap-1 px-0 py-1 text-xs text-primary"
                          onClick={() => (labelMode ? onPrint(r) : setEdit(r))}
                        >
                          {labelMode
                            ? "Έκδοση ετικέτας"
                            : canEdit
                              ? "Επεξεργασία"
                              : "Προβολή"}
                          <ChevronRight size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      {(edit || create) && (
        <RecordEditor
          row={edit}
          kind={kind}
          editable={canEdit}
          onClose={() => {
            setEdit(null);
            setCreate(false);
          }}
          onSaved={reload}
        />
      )}
    </>
  );
}
