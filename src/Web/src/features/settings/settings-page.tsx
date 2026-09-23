import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Catalog } from "@/features/catalog/catalog-page";
import { api, post } from "@/lib/api";
import { today } from "@/lib/dates";
import { type Data } from "@/types/records";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsPage({ admin }: { admin: boolean }) {
  const [tab, setTab] = useState("printer"),
    [users, setUsers] = useState<Data[]>([]),
    [agents, setAgents] = useState<Data[]>([]),
    [audit, setAudit] = useState<Data[]>([]),
    [error, setError] = useState(""),
    [token, setToken] = useState("");
  const [backup, setBackup] = useState<Data | null>(null),
    [backingUp, setBackingUp] = useState(false);
  useEffect(() => {
    if (admin) {
      Promise.all([
        api<Data[]>("/users"),
        api<Data[]>("/agents"),
        api<Data[]>("/audit"),
        api<Data>("/backup"),
      ])
        .then(([u, a, log, backup]) => {
          setUsers(u);
          setAgents(a);
          setAudit(log);
          setBackup(backup);
        })
        .catch((e) => setError(e.message));
    }
  }, [admin, tab]);
  if (!admin)
    return <Notice text="Οι ρυθμίσεις είναι διαθέσιμες στον διαχειριστή." />;
  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <TabsList
        variant="line"
        className="mb-5 h-auto w-full flex-wrap justify-start"
        aria-label="Ρυθμίσεις"
      >
        {[
          ["printer", "Εκτυπωτές"],
          ["language", "Γλώσσες"],
          ["reference", "Λίστες"],
          ["certificate-customer", "Πελάτες εξωτερικού"],
          ["vehicle", "Οχήματα"],
          ["users", "Χρήστες"],
          ["agents", "Βοηθοί εκτύπωσης"],
          ["audit", "Καταγραφή ενεργειών"],
          ["backup", "Αντίγραφα ασφαλείας"],
        ].map(([k, l]) => (
          <TabsTrigger
            value={k}
            className="flex-none px-3 py-2 text-xs"
            key={k}
          >
            {l}
          </TabsTrigger>
        ))}
      </TabsList>
      <Notice text={error} />
      <TabsContent value={tab}>
        {tab === "backup" ? (
          <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card p-5">
            <h2>Αντίγραφα ασφαλείας</h2>
            <p>
              {backup?.enabled
                ? `Αυτόματο αντίγραφο στις ${backup.hour}:00 · Διατήρηση ${backup.retentionDays} ημέρες`
                : "Τα αυτόματα αντίγραφα δεν είναι ενεργοποιημένα."}
            </p>
            <Button
              variant="default"
              type="submit"
              className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
              disabled={backingUp}
              onClick={async () => {
                setBackingUp(true);
                setError("");
                try {
                  const response = await fetch("/api/backup", {
                    method: "POST",
                    headers: { "X-Faethon-Request": "1" },
                  });
                  if (!response.ok)
                    throw new Error(
                      "Το αντίγραφο απέτυχε. Ελέγξτε τη ρύθμιση pg_dump στον διακομιστή.",
                    );
                  const url = URL.createObjectURL(await response.blob());
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `faethon-${today()}.zip`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                  setBackup(await api("/backup"));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBackingUp(false);
                }
              }}
            >
              {backingUp
                ? "Δημιουργία αντιγράφου…"
                : "Δημιουργία και λήψη αντιγράφου"}
            </Button>
            {backup?.recent?.map((item: Data, i: number) => (
              <div
                className="flex flex-wrap items-center gap-4 border-b py-5 text-sm [&_code]:text-xs [&_code]:text-muted-foreground [&_button]:ml-auto"
                key={i}
              >
                <span>{new Date(item.at).toLocaleString("el")}</span>
                <b>
                  {item.action === "backup.completed"
                    ? "Ολοκληρώθηκε"
                    : "Απέτυχε"}
                </b>
              </div>
            ))}
          </section>
        ) : !["users", "agents", "audit"].includes(tab) ? (
          <Catalog kind={tab} admin onPrint={() => {}} />
        ) : tab === "users" ? (
          <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card p-5">
            <h2>Λογαριασμοί</h2>
            <form
              className="grid grid-cols-1 gap-x-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                try {
                  await post("/users", {
                    name: form.get("name"),
                    password: form.get("password"),
                    role: form.get("role"),
                  });
                  setUsers(await api("/users"));
                  e.currentTarget?.reset();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field label="Όνομα χρήστη">
                <Input name="name" required />
              </Field>
              <Field label="Κωδικός (12+ χαρακτήρες)">
                <Input
                  name="password"
                  type="password"
                  minLength={12}
                  required
                />
              </Field>
              <Field label="Ρόλος">
                <NativeSelect name="role">
                  <option value="operator">Χειριστής</option>
                  <option value="admin">Διαχειριστής</option>
                </NativeSelect>
              </Field>
              <Button
                variant="default"
                type="submit"
                className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
              >
                Προσθήκη
              </Button>
            </form>
            {users.map((u) => (
              <div
                className="flex flex-wrap items-center gap-4 border-b py-5 text-sm [&_code]:text-xs [&_code]:text-muted-foreground [&_button]:ml-auto"
                key={u.id}
              >
                <b>{u.name}</b>
                <span>{u.role}</span>
                <Button
                  variant="outline"
                  type="submit"
                  className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
                  onClick={async () => {
                    try {
                      await api(`/users/${u.id}`, {
                        method: "PUT",
                        body: JSON.stringify({ disabled: !u.disabled }),
                      });
                      setUsers(await api("/users"));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {u.disabled ? "Ενεργοποίηση" : "Απενεργοποίηση"}
                </Button>
              </div>
            ))}
          </section>
        ) : tab === "agents" ? (
          <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card p-5">
            <h2>Σύνδεση βοηθού εκτύπωσης</h2>
            <p>
              Συνδέστε τον υπολογιστή που έχει πρόσβαση στις ουρές των
              εκτυπωτών.
            </p>
            <Button
              variant="default"
              type="submit"
              className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
              onClick={async () => {
                const name = prompt("Όνομα σταθμού εργασίας");
                if (!name) return;
                try {
                  const a = await post("/agents", { name });
                  setToken(`ID: ${a.id}\nToken: ${a.token}`);
                  setAgents(await api("/agents"));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Plus size={16} />
              Νέος βοηθός
            </Button>
            {token && (
              <div className="my-3 mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 [&_b]:flex [&_b]:items-center [&_b]:gap-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:leading-loose">
                <b>Αποθηκεύστε το κλειδί στον βοηθό. Εμφανίζεται μόνο τώρα.</b>
                <pre>{token}</pre>
              </div>
            )}
            {agents.map((a) => (
              <div
                className="flex flex-wrap items-center gap-4 border-b py-5 text-sm [&_code]:text-xs [&_code]:text-muted-foreground [&_button]:ml-auto"
                key={a.id}
              >
                <b>{a.name}</b>
                <code>{a.id}</code>
                <span>
                  {a.lastSeen
                    ? new Date(a.lastSeen).toLocaleString("el")
                    : "Δεν έχει συνδεθεί"}
                </span>
              </div>
            ))}
          </section>
        ) : (
          <section className="mb-6 min-w-0 overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ΧΡΟΝΟΣ</TableHead>
                  <TableHead>ΧΡΗΣΤΗΣ</TableHead>
                  <TableHead>ΕΝΕΡΓΕΙΑ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{new Date(a.at).toLocaleString("el")}</TableCell>
                    <TableCell>{a.actor}</TableCell>
                    <TableCell>{a.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
      </TabsContent>
    </Tabs>
  );
}
