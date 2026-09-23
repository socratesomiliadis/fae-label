import { Busy } from "@/components/feedback/busy";
import { Empty } from "@/components/feedback/empty";
import { Notice } from "@/components/feedback/notice";
import { Badge } from "@/components/feedback/status-badge";
import { Heading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { type Data } from "@/types/records";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Package,
  Plus,
  Printer,
  Tags,
} from "lucide-react";
import { useEffect, useState } from "react";

export function Dashboard({ navigate }: { navigate: (p: string) => void }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <Heading title="Επισκόπηση">
        <Button
          variant="default"
          type="submit"
          className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
          onClick={() => navigate("production")}
        >
          <Plus size={18} />
          Νέα εκτύπωση
        </Button>
      </Heading>
      <Notice text={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>button]:h-auto [&>button]:justify-start [&>button]:gap-4 [&>button]:whitespace-normal [&>button]:rounded-xl [&>button]:border [&>button]:bg-card [&>button]:p-5 [&>button]:text-left [&_b]:text-xs [&_svg]:text-primary [&_svg:last-child]:ml-auto">
        {[
          ["production", "Ετικέτες προϊόντων", Printer],
          ["daily", "Καθημερινή παραγωγή", CalendarDays],
          ["sample", "Δείγμα", Tags],
          ["custom", "Ελεύθερη ετικέτα", Plus],
          ["butcher", "Κρεοπωλείο", Package],
          ["production-label", "Προς παραγωγή", BookOpen],
        ].map(([key, label, Icon]) => {
          const I = Icon as typeof Tags;
          return (
            <Button
              variant="ghost"
              type="submit"
              key={String(key)}
              onClick={() => navigate(String(key))}
            >
              <I size={20} />
              <b>{String(label)}</b>
              <ChevronRight size={16} />
            </Button>
          );
        })}
      </div>
      <div className="my-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ["Προϊόντα", data?.products, Tags, "product"],
          ["Συστάσεις", data?.recipes, BookOpen, "recipe"],
          ["Στην ουρά", data?.queued, Printer, "history"],
          ["Χρειάζονται έλεγχο", data?.attention, AlertTriangle, "history"],
        ].map(([label, value, Icon, target]) => {
          const I = Icon as typeof Tags;
          return (
            <Button
              variant="ghost"
              type="submit"
              className="block h-auto rounded-xl border bg-card p-5 text-left [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:text-xs [&>div]:text-muted-foreground [&_strong]:my-3 [&_strong]:block [&_strong]:text-3xl [&_strong]:font-medium [&_small]:flex [&_small]:items-center [&_small]:gap-1.5"
              key={String(label)}
              onClick={() => navigate(String(target))}
            >
              <div>
                <span>{String(label)}</span>
                <I size={19} />
              </div>
              <strong>{value === undefined ? "—" : String(value)}</strong>
              <small>
                Προβολή <ArrowUpRight size={13} />
              </small>
            </Button>
          );
        })}
      </div>
      <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4 [&_h2]:mb-0 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2]:text-base">
          <div>
            <h2>Πρόσφατες εκτυπώσεις</h2>
          </div>
          <Button
            variant="ghost"
            type="submit"
            className="h-auto gap-1 px-0 py-1 text-xs text-primary"
            onClick={() => navigate("history")}
          >
            Όλο το ιστορικό <ChevronRight size={16} />
          </Button>
        </div>
        {!data ? (
          <Busy />
        ) : data.recent.length === 0 ? (
          <Empty>Δεν υπάρχουν εκτυπώσεις ακόμα.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ΧΡΟΝΟΣ</TableHead>
                <TableHead>ΧΕΙΡΙΣΤΗΣ</TableHead>
                <TableHead>ΠΟΣΟΤΗΤΑ</TableHead>
                <TableHead>ΚΑΤΑΣΤΑΣΗ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((j: Data) => (
                <TableRow key={j.id}>
                  <TableCell>
                    {new Date(j.createdAt).toLocaleString("el")}
                  </TableCell>
                  <TableCell>{j.actor}</TableCell>
                  <TableCell>{j.quantity}</TableCell>
                  <TableCell>
                    <Badge status={j.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
