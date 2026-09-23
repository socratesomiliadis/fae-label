import { Empty } from "@/components/feedback/empty";
import { Notice } from "@/components/feedback/notice";
import { Badge } from "@/components/feedback/status-badge";
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
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function HistoryPage() {
  const [jobs, setJobs] = useState<Data[]>([]),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("");
  const reload = useCallback(
    () =>
      api<Data[]>("/jobs")
        .then(setJobs)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return (
    <>
      <Heading title="Κάθε εκτύπωση, καταγεγραμμένη.">
        <Button
          variant="outline"
          type="submit"
          className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
          onClick={reload}
        >
          <RefreshCw size={16} />
          Ανανέωση
        </Button>
      </Heading>
      <Notice text={error} />
      <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-4 border-b p-4 sm:px-5 [&>[data-slot=native-select-wrapper]]:w-48">
          <div className="relative min-w-40 max-w-md flex-1 [&_svg]:absolute [&_svg]:top-3 [&_svg]:left-3 [&_svg]:text-muted-foreground [&_input]:bg-muted/40 [&_input]:pl-10">
            <Search size={18} />
            <Input
              placeholder="Αναζήτηση LOT, προϊόντος ή χειριστή…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        {!jobs.length ? (
          <Empty>Το ιστορικό εκτυπώσεων θα εμφανιστεί εδώ.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ΕΤΙΚΕΤΑ / LOT</TableHead>
                <TableHead>ΗΜΕΡΟΜΗΝΙΑ</TableHead>
                <TableHead>ΑΝΤΙΤΥΠΑ</TableHead>
                <TableHead>ΚΑΤΑΣΤΑΣΗ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs
                .filter((j) =>
                  (j.snapshot + " " + j.actor)
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((j) => {
                  const s = JSON.parse(j.snapshot);
                  return (
                    <TableRow key={j.id}>
                      <TableCell>
                        <b>
                          {s.content?.product?.names?.el ||
                            s.content?.template?.name ||
                            "Ετικέτα"}
                        </b>
                        <small className="font-mono text-xs">
                          {s.content?.lot} · {j.actor}
                        </small>
                        {j.detail && <small>{j.detail}</small>}
                      </TableCell>
                      <TableCell>
                        {new Date(j.createdAt).toLocaleString("el")}
                      </TableCell>
                      <TableCell>{j.quantity}</TableCell>
                      <TableCell>
                        <Badge status={j.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-3">
                          <a
                            className="h-auto gap-1 px-0 py-1 text-xs text-primary"
                            href={`/api/jobs/${j.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            PDF
                          </a>
                          {["uncertain", "failed", "queued"].includes(
                            j.status,
                          ) ? (
                            <Button
                              variant="outline"
                              type="submit"
                              className="h-auto gap-1 px-0 py-1 text-xs text-primary"
                              onClick={async () => {
                                const note = prompt(
                                  "Αποτέλεσμα ελέγχου / λόγος ακύρωσης",
                                );
                                if (!note) return;
                                try {
                                  await post(`/jobs/${j.id}/resolve`, {
                                    version: j.version,
                                    status:
                                      j.status === "queued"
                                        ? "cancelled"
                                        : "confirmed",
                                    note,
                                  });
                                  await reload();
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                              }}
                            >
                              Επίλυση
                            </Button>
                          ) : (
                            !["claimed"].includes(j.status) && (
                              <Button
                                variant="outline"
                                type="submit"
                                className="h-auto gap-1 px-0 py-1 text-xs text-primary"
                                onClick={async () => {
                                  const quantity = Number(
                                    prompt(
                                      "Αριθμός αντιτύπων επανεκτύπωσης",
                                      "1",
                                    ),
                                  );
                                  if (!quantity) return;
                                  try {
                                    await post(`/jobs/${j.id}/reprint`, {
                                      requestKey: crypto.randomUUID(),
                                      quantity,
                                    });
                                    await reload();
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                Επανεκτύπωση
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
