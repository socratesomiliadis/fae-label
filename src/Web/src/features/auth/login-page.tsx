import { FaethonLogo } from "@/components/brand/faethon-logo";
import { Notice } from "@/components/feedback/notice";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, post } from "@/lib/api";
import { type User } from "@/types/records";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [token, setToken] = useState(""),
    [setup, setSetup] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/setup")
      .then((s) => setSetup(s.required))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="grid min-h-screen md:grid-cols-2 [&>form]:m-auto [&>form]:w-full [&>form]:max-w-xl [&>form]:p-8 lg:[&>form]:p-16 [&_form>button]:mt-4 [&_form>button]:w-full">
      <div className="hidden flex-col items-start justify-center bg-primary p-[7vw] text-primary-foreground md:flex [&>span]:mt-6 [&>span]:text-xs [&>span]:tracking-widest">
        <FaethonLogo className="h-48" />
        <span>ΦΑΕΘΩΝ / LABEL STUDIO</span>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (setup)
              await api("/setup", {
                method: "POST",
                headers: { "X-Setup-Token": token },
                body: JSON.stringify({ name, password }),
              });
            onLogin(await post("/login", { name, password }));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{setup ? "Αρχική εγκατάσταση" : "Σύνδεση στο εργαστήριο"}</h2>
        <Field label="Όνομα χρήστη">
          <Input
            autoComplete="username"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Κωδικός πρόσβασης">
          <Input
            type="password"
            autoComplete={setup ? "new-password" : "current-password"}
            required
            minLength={setup ? 12 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {setup && (
          <Field label="Κλειδί αρχικής εγκατάστασης">
            <Input
              type="password"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
        )}
        <Notice text={error} />
        <Button
          variant="default"
          type="submit"
          className="h-auto min-h-10 gap-2 px-4 py-2.5 text-xs font-semibold"
          disabled={busy}
        >
          {busy ? "Σύνδεση…" : setup ? "Δημιουργία διαχειριστή" : "Είσοδος"}
          <ArrowUpRight size={18} />
        </Button>
      </form>
    </div>
  );
}
