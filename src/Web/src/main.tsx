import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Tags,
  BookOpen,
  Printer,
  CalendarDays,
  Users,
  Layers,
  History,
  Settings,
  Upload,
  Search,
  Plus,
  ChevronRight,
  ArrowUpRight,
  Check,
  AlertTriangle,
  X,
  LogOut,
  FileCheck,
  SlidersHorizontal,
  Save,
  Eye,
  ArrowUp,
  ArrowDown,
  LoaderCircle,
  Package,
  RefreshCw,
} from "lucide-react";
import {
  api,
  post,
  today,
  nameOf,
  statuses,
  type Row,
  type Data,
  type Preview,
  type User,
} from "./api";
import "./style.css";
import { BusinessFields } from "./BusinessFields";
import {
  productValue,
  groupNames,
  lotOf,
  expiryOf,
  defaultWeight,
} from "./product";

const menus = [
  ["dashboard", "Επισκόπηση", LayoutDashboard],
  ["production", "Έκδοση ετικετών", Printer],
  ["daily", "Καθημερινή παραγωγή", CalendarDays],
  ["product", "Προϊόντα", Tags],
  ["recipe", "Συστάσεις", BookOpen],
  ["customer", "Πελάτες", Users],
  ["brand", "Ιδιωτική ετικέτα", Package],
  ["certificate", "Πιστοποιητικά", FileCheck],
  ["template", "Πρότυπα", Layers],
  ["history", "Ιστορικό εκτυπώσεων", History],
  ["imports", "Εισαγωγή δεδομένων", Upload],
  ["settings", "Ρυθμίσεις", Settings],
] as const;
function useRows(kind: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(kind ? await api(`/records/${kind}`) : []);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, error, loading, reload };
}
function Notice({ text }: { text: string }) {
  return text ? (
    <div className="notice" role="alert">
      <AlertTriangle size={17} />
      <span>{text}</span>
    </div>
  ) : null;
}
function Busy() {
  return (
    <div className="loading">
      <LoaderCircle size={22} className="spin" /> Φόρτωση…
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <Layers size={32} />
      <p>{children}</p>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("dashboard"),
    [selected, setSelected] = useState<Row | null>(null),
    [offline, setOffline] = useState(false);
  useEffect(() => {
    api<User>("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      api("/me")
        .then(() => setOffline(false))
        .catch(() => setOffline(true));
    }, 15000);
    return () => clearInterval(id);
  }, [user]);
  if (!ready) return <Busy />;
  if (!user) return <Login onLogin={setUser} />;
  const nav = (next: string) => {
    setPage(next);
    if (next !== "production") setSelected(null);
  };
  return (
    <div className="shell">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            nav("dashboard");
          }}
        >
          <div className="brand-mark">Φ</div>
          <div>
            ΦΑΕΘΩΝ<small>LABEL STUDIO</small>
          </div>
        </a>
        <nav>
          {menus
            .filter(
              ([key]) =>
                user.role === "admin" ||
                !["settings", "imports", "template"].includes(key),
            )
            .map(([key, label, Icon]) => (
              <React.Fragment key={key}>
                <button
                  className={page === key ? "active" : ""}
                  onClick={() => nav(key)}
                >
                  <Icon size={18} />
                  {label}
                  {page === key && <span className="nav-indicator" />}
                </button>
              </React.Fragment>
            ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{user.name[0]?.toUpperCase()}</div>
          <div>
            <b>{user.name}</b>
            <small>
              {user.role === "admin" ? "Διαχειριστής" : "Χειριστής"}
            </small>
          </div>
          <button
            aria-label="Αποσύνδεση"
            onClick={async () => {
              await post("/logout", {});
              setUser(null);
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            <b>
              {menus.find((m) => m[0] === page)?.[1] ||
                (
                  {
                    sample: "Δείγμα",
                    custom: "Ελεύθερη ετικέτα",
                    butcher: "Κρεοπωλείο",
                    "production-label": "Προς παραγωγή",
                  } as Record<string, string>
                )[page]}
            </b>
          </div>
          <div className="header-right">
            <span className={offline ? "connection bad" : "connection"}>
              <span className="dot" />
              {offline ? "Χωρίς σύνδεση" : "Συνδεδεμένο"}
            </span>
            <span>
              {new Intl.DateTimeFormat("el", { dateStyle: "long" }).format(
                new Date(),
              )}
            </span>
          </div>
        </header>
        <div className="content">
          {offline && (
            <Notice text="Δεν υπάρχει σύνδεση με τον διακομιστή. Οι εκτυπώσεις δεν μπορούν να υποβληθούν." />
          )}
          {page === "dashboard" ? (
            <Dashboard navigate={nav} />
          ) : [
              "production",
              "sample",
              "custom",
              "butcher",
              "production-label",
            ].includes(page) ? (
            <ProductionPage key={page} initial={selected} workflow={page} />
          ) : page === "daily" ? (
            <Daily />
          ) : page === "history" ? (
            <HistoryPage />
          ) : page === "imports" ? (
            <Imports admin={user.role === "admin"} />
          ) : page === "settings" ? (
            <SettingsPage admin={user.role === "admin"} />
          ) : page === "certificate" ? (
            <Certificates />
          ) : (
            <Catalog
              kind={page}
              admin={user.role === "admin"}
              onPrint={(row) => {
                setSelected(row);
                setPage("production");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
function Login({ onLogin }: { onLogin: (u: User) => void }) {
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
    <div className="login">
      <div className="login-story">
        <div className="brand-mark">Φ</div>
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
          <input
            autoComplete="username"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Κωδικός πρόσβασης">
          <input
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
            <input
              type="password"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
        )}
        <Notice text={error} />
        <button className="primary" disabled={busy}>
          {busy ? "Σύνδεση…" : setup ? "Δημιουργία διαχειριστή" : "Είσοδος"}
          <ArrowUpRight size={18} />
        </button>
      </form>
    </div>
  );
}
function Heading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Dashboard({ navigate }: { navigate: (p: string) => void }) {
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
        <button className="primary" onClick={() => navigate("production")}>
          <Plus size={18} />
          Νέα εκτύπωση
        </button>
      </Heading>
      <Notice text={error} />
      <div className="quick-links workflow-links">
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
            <button key={String(key)} onClick={() => navigate(String(key))}>
              <I size={20} />
              <b>{String(label)}</b>
              <ChevronRight size={16} />
            </button>
          );
        })}
      </div>
      <div className="stats">
        {[
          ["Προϊόντα", data?.products, Tags, "product"],
          ["Συστάσεις", data?.recipes, BookOpen, "recipe"],
          ["Στην ουρά", data?.queued, Printer, "history"],
          ["Χρειάζονται έλεγχο", data?.attention, AlertTriangle, "history"],
        ].map(([label, value, Icon, target]) => {
          const I = Icon as typeof Tags;
          return (
            <button
              className="stat"
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
            </button>
          );
        })}
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Πρόσφατες εκτυπώσεις</h2>
          </div>
          <button className="text-button" onClick={() => navigate("history")}>
            Όλο το ιστορικό <ChevronRight size={16} />
          </button>
        </div>
        {!data ? (
          <Busy />
        ) : data.recent.length === 0 ? (
          <Empty>Δεν υπάρχουν εκτυπώσεις ακόμα.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ΧΡΟΝΟΣ</th>
                <th>ΧΕΙΡΙΣΤΗΣ</th>
                <th>ΠΟΣΟΤΗΤΑ</th>
                <th>ΚΑΤΑΣΤΑΣΗ</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((j: Data) => (
                <tr key={j.id}>
                  <td>{new Date(j.createdAt).toLocaleString("el")}</td>
                  <td>{j.actor}</td>
                  <td>{j.quantity}</td>
                  <td>
                    <Badge status={j.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge ${status === "uncertain" || status === "failed" ? "warning" : status === "submitted" || status === "confirmed" ? "success" : ""}`}
    >
      <span className="dot" />
      {statuses[status] || status}
    </span>
  );
}
const defaults: Record<string, Data> = {
  template: {
    name: "",
    family: "thermal",
    profile: "small",
    geometryKey: "",
    barcodeFormat: "code39",
    widthMm: 100,
    heightMm: 82,
    fontSize: 7,
    validated: false,
    validationNote: "",
    approvalAssets: [],
    qrPayload: "",
  },
  printer: {
    name: "",
    queue: "",
    agentId: "00000000-0000-0000-0000-000000000000",
    transport: "windows",
    dpi: 203,
    dotsPerMm: 8,
    widthMm: 100,
    heightMm: 82,
    printableWidthMm: 100,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    validated: false,
  },
  product: {
    sourceId: "",
    erpCode: "",
    secondaryCode: "",
    barcode: "",
    cartonBarcode: "",
    recipeCode: "",
    brands: ["1"],
    names: { el: "", en: "" },
    fields: {},
    legacyProduction: {},
    active: true,
    daily: false,
    dailyOrder: 0,
    shelfLife: 0,
    frozen: false,
  },
  recipe: {
    code: "",
    name: "",
    family: "10",
    category: "",
    originKey: "",
    specificationAsset: "",
    translations: {
      el: { ingredients: "", allergens: "", nutrition: "" },
      en: { ingredients: "", allergens: "", nutrition: "" },
    },
    nutrition: {},
  },
  brand: {
    name: "",
    group: "brand",
    texts: { el: "", en: "" },
    manufacturer: { el: "", en: "" },
    origins: {},
    logoAsset: "",
    address: "",
    vat: "",
    city: "",
    country: "",
    layoutProfile: "",
    complete: false,
  },
  customer: {
    name: "",
    tradeName: "",
    phone: "",
    email: "",
    address: "",
    vat: "",
    city: "",
    country: "",
    texts: {},
    complete: true,
  },
  reference: {
    name: "",
    group: "",
    texts: { el: "", en: "" },
    complete: false,
  },
  language: { name: "", headings: {}, complete: false },
  vehicle: { name: "", address: "" },
  "certificate-customer": {
    name: "",
    address: "",
    vat: "",
    city: "",
    country: "",
    texts: {},
    complete: true,
  },
};
function Catalog({
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
      rows.filter(
        (r) =>
          (
            nameOf(r) +
            " " +
            r.key +
            " " +
            (r.data.erpCode || "") +
            " " +
            (r.data.family || "") +
            " " +
            JSON.stringify(r.data.fields || {}) +
            " " +
            [
              r.data.vat,
              r.data.city,
              r.data.country,
              r.data.tradeName,
              r.data.category,
            ].join(" ")
          )
            .toLocaleLowerCase("el")
            .includes(search.toLocaleLowerCase("el")) &&
          (filter === "all" ||
            (filter === "active" && r.data.active) ||
            (filter === "daily" && r.data.daily) ||
            (filter === "inactive" && !r.data.active) ||
            (filter === "butcher" && r.data.butcher) ||
            (filter === "private" &&
              r.data.brands?.some((b: string) => b !== "1"))) &&
          (!labelMode ||
            (r.data.active &&
              (filter === "butcher" ? r.data.butcher : !r.data.butcher))) &&
          Object.entries(filters).every(
            ([k, v]) =>
              !v ||
              (kind === "product"
                ? productValue(r, k, recipes.rows)
                : String(r.data[k] || "")) === v,
          ),
      ),
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
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Νέα εγγραφή
          </button>
        )}
      </Heading>
      <Notice text={error} />
      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              placeholder="Αναζήτηση με περιγραφή ή κωδικό…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {kind === "product" && (
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {!labelMode && <option value="all">Όλα τα προϊόντα</option>}
              <option value="active">Ενεργά</option>
              <option value="daily">Καθημερινά</option>
              {!labelMode && <option value="inactive">Ανενεργά</option>}
              <option value="private">Private label</option>
              <option value="butcher">Κρεοπωλείου</option>
            </select>
          )}
          <span className="count">{filtered.length} εγγραφές</span>
        </div>
        {["product", "recipe", "customer", "reference"].includes(kind) && (
          <div className="catalog-filters">
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
                <select
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
                </select>
              </Field>
            ))}
            {Object.values(filters).some(Boolean) && (
              <button className="text-button" onClick={() => setFilters({})}>
                Καθαρισμός
              </button>
            )}
          </div>
        )}
        {loading ? (
          <Busy />
        ) : filtered.length === 0 ? (
          <Empty>Δεν βρέθηκαν εγγραφές.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ΚΩΔΙΚΟΣ</th>
                  <th>ΠΕΡΙΓΡΑΦΗ</th>
                  <th>{kind === "product" ? "ΣΥΣΤΑΣΗ" : "ΣΤΟΙΧΕΙΑ"}</th>
                  <th>ΚΑΤΑΣΤΑΣΗ</th>
                  {kind === "product" && (
                    <>
                      <th>ΟΙΚΟΓΕΝΕΙΑ</th>
                      <th>ΣΥΣΚΕΥΑΣΙΑ</th>
                    </>
                  )}
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">
                      {r.data.erpCode || r.key}
                      {r.data.secondaryCode && (
                        <small>
                          {r.data.secondaryCode} · #{r.key}
                        </small>
                      )}
                    </td>
                    <td>
                      <b>{nameOf(r)}</b>
                      {kind === "template" && (
                        <small>
                          {r.data.widthMm} × {r.data.heightMm} mm ·{" "}
                          {r.data.profile}
                        </small>
                      )}
                    </td>
                    <td>
                      {r.data.recipeCode ||
                        r.data.family ||
                        r.data.group ||
                        r.data.city ||
                        "—"}
                    </td>
                    <td>
                      <span
                        className={`badge ${r.data.active || r.data.complete || r.data.validated ? "success" : "neutral"}`}
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
                      </span>
                      {kind === "product" && r.data.daily && (
                        <small>Καθημερινό</small>
                      )}
                    </td>
                    {kind === "product" && (
                      <>
                        <td>
                          {productValue(r, "family", recipes.rows)}
                          <small>{productValue(r, "condition")}</small>
                        </td>
                        <td>{productValue(r, "Συσκευασία Προϊόντος")}</td>
                      </>
                    )}
                    <td>
                      <div className="row-actions">
                        {!labelMode &&
                          ["product", "customer"].includes(kind) && (
                            <button
                              className="icon-button"
                              title="Έκδοση ετικέτας"
                              onClick={() => onPrint(r)}
                            >
                              <Printer size={17} />
                            </button>
                          )}
                        <button
                          className="text-button"
                          onClick={() => (labelMode ? onPrint(r) : setEdit(r))}
                        >
                          {labelMode
                            ? "Έκδοση ετικέτας"
                            : canEdit
                              ? "Επεξεργασία"
                              : "Προβολή"}
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const labels: Record<string, string> = {
  tradeName: "Διακριτικός τίτλος",
  phone: "Τηλέφωνο",
  email: "Email",
  geometryKey: "Διάταξη",
  barcodeFormat: "Τύπος barcode",
  sourceId: "Ταυτότητα πηγής",
  erpCode: "Κωδικός ERP",
  secondaryCode: "Δευτερεύων κωδικός",
  barcode: "Barcode προϊόντος",
  cartonBarcode: "Barcode κιβωτίου",
  recipeCode: "Κωδικός σύστασης",
  brands: "Επωνυμίες (κωδικοί με κόμμα)",
  names: "Περιγραφές ανά γλώσσα",
  fields: "Στοιχεία προϊόντος",
  active: "Ενεργό",
  daily: "Καθημερινό",
  dailyOrder: "Σειρά καθημερινών",
  shelfLife: "Ημέρες λήξης",
  frozen: "Κατεψυγμένο",
  code: "Κωδικός",
  name: "Περιγραφή",
  family: "Οικογένεια",
  category: "Κατηγορία",
  originKey: "Κωδικός προέλευσης",
  specificationAsset: "Αρχείο τεχνικής προδιαγραφής",
  translations: "Μεταφράσεις",
  ingredients: "Συστατικά",
  allergens: "Αλλεργιογόνα",
  nutrition: "Διατροφικά στοιχεία",
  group: "Ομάδα",
  texts: "Κείμενα ανά γλώσσα",
  manufacturer: "Παρασκευαστής ανά γλώσσα",
  origins: "Προέλευση ανά γλώσσα",
  logoAsset: "Λογότυπο",
  address: "Διεύθυνση",
  vat: "ΑΦΜ",
  city: "Πόλη",
  country: "Χώρα",
  layoutProfile: "Ειδικό προφίλ διάταξης",
  complete: "Πλήρη στοιχεία",
  profile: "Προφίλ",
  widthMm: "Πλάτος (mm)",
  heightMm: "Ύψος (mm)",
  fontSize: "Μέγεθος κειμένου (pt)",
  validated: "Δοκιμασμένο και επικυρωμένο",
  validationNote: "Αποτέλεσμα φυσικής δοκιμής",
  approvalAssets: "Εικόνες σημάτων έγκρισης",
  qrPayload: "Περιεχόμενο QR",
  queue: "Όνομα ουράς Windows",
  agentId: "Βοηθός εκτύπωσης (ID)",
  dpi: "Ανάλυση DPI",
  dotsPerMm: "Κουκκίδες ανά mm",
  printableWidthMm: "Εκτυπώσιμο πλάτος (mm)",
  rotation: "Περιστροφή",
  offsetX: "Μετατόπιση X (κουκκίδες)",
  offsetY: "Μετατόπιση Y (κουκκίδες)",
  transport: "Τύπος: zpl / windows",
  headings: "Επικεφαλίδες",
};
function ObjectFields({
  data,
  onChange,
  disabled = false,
  path = "",
}: {
  data: Data;
  onChange: (d: Data) => void;
  disabled?: boolean;
  path?: string;
}) {
  return (
    <div className="form-grid">
      {Object.entries(data)
        .filter(([k]) => !["legacyProduction", "runs", "expiry"].includes(k))
        .map(([k, v]) => {
          const label = labels[k] || k;
          if (v !== null && typeof v === "object" && !Array.isArray(v))
            return (
              <details
                key={k}
                className="field-group"
                open={Object.keys(v).length < 5}
              >
                <summary>
                  {label}
                  <small>{Object.keys(v).length} πεδία</small>
                </summary>
                <ObjectFields
                  data={v}
                  onChange={(next) => onChange({ ...data, [k]: next })}
                  disabled={disabled}
                  path={path + "." + k}
                />
                {!disabled && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      const key = prompt("Κωδικός νέου πεδίου / γλώσσας");
                      if (key && !Object.hasOwn(v, key))
                        onChange({
                          ...data,
                          [k]: {
                            ...v,
                            [key]:
                              k === "translations"
                                ? {
                                    ingredients: "",
                                    allergens: "",
                                    nutrition: "",
                                  }
                                : "",
                          },
                        });
                    }}
                  >
                    <Plus size={14} />
                    Προσθήκη πεδίου
                  </button>
                )}
              </details>
            );
          if (typeof v === "boolean")
            return (
              <label className="check-field" key={k}>
                <input
                  type="checkbox"
                  checked={v}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...data, [k]: e.target.checked })}
                />
                {label}
              </label>
            );
          if (k.toLowerCase().endsWith("asset"))
            return (
              <div className="field" key={k}>
                <span>{label}</span>
                <input
                  value={String(v || "")}
                  disabled={disabled}
                  placeholder="Χωρίς αρχείο"
                  onChange={(e) => onChange({ ...data, [k]: e.target.value })}
                />
                {v && (
                  <a href={`/api/assets/${v}`} target="_blank" rel="noreferrer">
                    Προβολή αρχείου
                  </a>
                )}
                {!disabled && (
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={async (e) => {
                      if (!e.target.files?.[0]) return;
                      const f = new FormData();
                      f.append("file", e.target.files[0]);
                      try {
                        const r = await api("/assets", {
                          method: "POST",
                          body: f,
                        });
                        onChange({ ...data, [k]: r.hash });
                      } catch (err) {
                        alert((err as Error).message);
                      }
                    }}
                  />
                )}
              </div>
            );
          const isLong =
            typeof v === "string" &&
            (v.length > 90 ||
              [
                "ingredients",
                "allergens",
                "nutrition",
                "validationNote",
                "address",
              ].includes(k) ||
              path.includes("texts") ||
              path.includes("headings"));
          return (
            <Field label={label} key={k}>
              {isLong ? (
                <textarea
                  rows={3}
                  value={String(v || "")}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...data, [k]: e.target.value })}
                />
              ) : (
                <input
                  type={typeof v === "number" ? "number" : "text"}
                  value={Array.isArray(v) ? v.join(", ") : (v ?? "")}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      [k]: Array.isArray(v)
                        ? e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean)
                        : typeof v === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </Field>
          );
        })}
    </div>
  );
}
function RecordEditor({
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
  const [data, setData] = useState<Data>(
      structuredClone({ ...defaults[kind], ...row?.data }),
    ),
    [key, setKey] = useState(row?.key || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="overlay">
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Επεξεργασία εγγραφής"
      >
        <div className="drawer-header">
          <div>
            <h2>{row ? nameOf(row) : "Νέα καταχώρηση"}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Κλείσιμο"
          >
            <X />
          </button>
        </div>
        <form
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
              onSaved();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="drawer-body">
            <Notice text={error} />
            {!["product", "recipe"].includes(kind) && (
              <Field label="Κωδικός">
                <input
                  required
                  value={key}
                  disabled={!!row || !editable}
                  onChange={(e) => setKey(e.target.value)}
                />
              </Field>
            )}
            {["product", "recipe", "reference"].includes(kind) ? (
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
          <div className="drawer-footer">
            <button type="button" className="secondary" onClick={onClose}>
              Κλείσιμο
            </button>
            {editable && (
              <button className="primary" disabled={busy}>
                <Save size={16} />
                Αποθήκευση
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function draftFor(product: Row | null, offset = 0): Data {
  return {
    productId: product?.id || null,
    name: product ? nameOf(product) : "",
    productionDate: today(offset),
    freezeDate: product?.data.frozen ? today(offset) : null,
    shelfLife: product?.data.shelfLife || 0,
    expiryOverride: null,
    weight: defaultWeight(product, "Βάρος Προϊόντος"),
    pieces: defaultWeight(product, "Τεμ./Κιβ."),
    cartonWeight: defaultWeight(product, "Βάρος Κιβωτίου"),
    palletWeight: null,
    animalCode: "",
    slaughterhouse: product?.data.fields?.["Αρ.Εγκρ.Σφ."] || "",
    supplier: product?.data.fields?.["Προμηθευτής"] || "",
    brandKey: product?.data.brands?.[0] || "1",
    mode: "product",
    languages: ["el", "en"],
    templateKey: "thermal-large",
    freeText: "",
    customerId: null,
  };
}
function ProductionPage({
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
  const change = (next: Data) => {
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
    setBusy(true);
    setError("");
    try {
      setPreview(await post("/preview", draft));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (
    workflow === "production" &&
    !draft.productId &&
    !draft.customerId &&
    draft.templateKey === "thermal-large"
  )
    return (
      <Catalog
        kind="product"
        admin={false}
        labelMode
        onPrint={(p) => change(draftFor(p))}
      />
    );
  return (
    <>
      <Heading
        title={
          workflow === "production"
            ? "Έκδοση ετικετών"
            : (
                {
                  sample: "Δείγμα",
                  custom: "Ελεύθερη ετικέτα",
                  butcher: "Κρεοπωλείο",
                  "production-label": "Προς παραγωγή",
                } as Record<string, string>
              )[workflow]
        }
      >
        {workflow === "production" && selected && (
          <button
            className="secondary"
            onClick={() => {
              change(draftFor(null));
              setSavedDraft(null);
            }}
          >
            Άλλο προϊόν
          </button>
        )}
      </Heading>
      <div className="production-grid">
        <section className="panel production-form">
          <div className="section-heading">
            <h2>Στοιχεία παραγωγής</h2>
          </div>
          <div className="pad">
            <Notice text={error || products.error || templates.error} />
            <div className="print-presets" aria-label="Μορφές ετικέτας">
              {[
                ["thermal-large", "product", "Μεγάλη GR/EN"],
                ["thermal-large", "carton", "Κιβώτιο GR/EN"],
                ["thermal-small", "product", "Μικρή"],
                ["pallet-a4", "product", "Παλέτα Α4"],
                ["sample-small", "product", "Δείγμα"],
                ["sample-blank", "blank", "Κενό δείγμα"],
                ["butcher-a4", "product", "Ταμπελάκια Α4"],
                ["butcher-a4", "blank", "Κενά ταμπελάκια"],
              ]
                .filter(([key]) => templates.rows.some((t) => t.key === key))
                .map(([key, mode, label]) => (
                  <button
                    key={key + mode}
                    className={
                      draft.templateKey === key && draft.mode === mode
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      change({
                        ...draft,
                        templateKey: key,
                        mode,
                        languages: ["thermal-large", "pallet-a4"].includes(key)
                          ? ["el", "en"]
                          : [draft.languages[0]],
                      });
                      if (key.startsWith("butcher")) setScope("butcher");
                    }}
                  >
                    {label}
                  </button>
                ))}
            </div>
            <div className="form-grid">
              <Field label="Πρότυπο">
                <select
                  value={draft.templateKey}
                  onChange={(e) => {
                    const t = templates.rows.find(
                      (t) => t.key === e.target.value,
                    );
                    change({
                      ...draft,
                      templateKey: e.target.value,
                      languages:
                        t?.data.profile === "small"
                          ? [draft.languages[0]]
                          : t?.data.family === "thermal"
                            ? ["el", "en"]
                            : draft.languages,
                    });
                  }}
                >
                  {templates.rows
                    .filter((t) => !t.data.family.startsWith("certificate"))
                    .map((t) => (
                      <option key={t.id} value={t.key}>
                        {nameOf(t)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Αποθηκευμένη προετοιμασία">
                <select
                  value={savedDraft?.id || ""}
                  onChange={(e) => {
                    const r = drafts.rows.find((r) => r.id === e.target.value);
                    if (r) {
                      change(r.data);
                      setSavedDraft(r);
                    } else {
                      setSavedDraft(null);
                      change({
                        ...draftFor(selected || null),
                        templateKey: draft.templateKey,
                        languages: draft.languages,
                      });
                    }
                  }}
                >
                  <option value="">Νέα προετοιμασία</option>
                  {drafts.rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {nameOf(r)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {productNeeded && (!selected || workflow !== "production") && (
              <div className="product-picker">
                <div className="form-grid">
                  <Field label="Λίστα προϊόντων">
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    >
                      <option value="active">Ενεργές ετικέτες</option>
                      <option value="private">Private label</option>
                      <option value="butcher">Κρεοπωλείου</option>
                    </select>
                  </Field>
                  <Field label="Αναζήτηση προϊόντος">
                    <input
                      placeholder="Κωδικός ή περιγραφή"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}
            {productNeeded && (!selected || workflow !== "production") && (
              <Field label="Προϊόν">
                <select
                  value={draft.productId || ""}
                  onChange={(e) => {
                    const p =
                      products.rows.find((p) => p.id === e.target.value) ||
                      null;
                    change({
                      ...draftFor(p),
                      templateKey: draft.templateKey,
                      languages: draft.languages,
                    });
                    setSavedDraft(null);
                  }}
                >
                  <option value="">Επιλέξτε προϊόν…</option>
                  {products.rows
                    .filter(
                      (p) =>
                        p.data.active &&
                        (scope === "butcher"
                          ? p.data.butcher
                          : !p.data.butcher) &&
                        (scope !== "private" ||
                          p.data.brands?.some((b: string) => b !== "1")) &&
                        (p.id === draft.productId ||
                          (p.data.erpCode + " " + nameOf(p))
                            .toLocaleLowerCase("el")
                            .includes(productSearch.toLocaleLowerCase("el"))),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.data.erpCode} · {p.data.secondaryCode} · {nameOf(p)}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {selected && (
              <details className="field-group">
                <summary>{nameOf(selected)}</summary>
                <p>
                  {recipes.rows.find((r) => r.key === selected.data.recipeCode)
                    ?.data.translations?.[draft.languages[0]]?.ingredients ||
                    "—"}
                </p>
                <p>
                  {
                    recipes.rows.find((r) => r.key === selected.data.recipeCode)
                      ?.data.translations?.[draft.languages[0]]?.allergens
                  }
                </p>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={!!selected.data.daily}
                    onChange={async (e) => {
                      try {
                        await post("/daily", [
                          {
                            id: selected.id,
                            version: selected.version,
                            daily: e.target.checked,
                            order: selected.data.dailyOrder || 0,
                          },
                        ]);
                        await products.reload();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                  Καθημερινό
                </label>
                <div className="brand-options">
                  {brands.rows.map((brand) => (
                    <label className="check-field" key={brand.id}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={selected.data.brands.includes(brand.key)}
                        onChange={async (e) => {
                          const next = e.target.checked
                            ? [...selected.data.brands, brand.key]
                            : selected.data.brands.filter(
                                (key: string) => key !== brand.key,
                              );
                          setBusy(true);
                          try {
                            await post(
                              `/products/${selected.id}/label-brands`,
                              { version: selected.version, brands: next },
                            );
                            await products.reload();
                            change({
                              ...draft,
                              brandKey: next.includes(draft.brandKey)
                                ? draft.brandKey
                                : next[0],
                            });
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                      {nameOf(brand)}
                    </label>
                  ))}
                </div>
              </details>
            )}
            <div className="form-grid">
              <Field label="Επωνυμία">
                <select
                  value={draft.brandKey}
                  onChange={(e) => set("brandKey", e.target.value)}
                >
                  {brands.rows
                    .filter(
                      (b) => !selected || selected.data.brands.includes(b.key),
                    )
                    .map((b) => (
                      <option key={b.id} value={b.key}>
                        {nameOf(b)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Περιεχόμενο">
                <select
                  value={draft.mode}
                  onChange={(e) => set("mode", e.target.value)}
                >
                  <option value="product">Προϊόν</option>
                  <option value="carton">Κιβώτιο</option>
                  {["butcher", "sample", "custom", "production"].includes(
                    selectedTemplate?.data.family,
                  ) && <option value="blank">Κενό / ελεύθερο</option>}
                </select>
              </Field>
              <Field label="Γλώσσα">
                <select
                  disabled={
                    selectedTemplate?.data.family === "thermal" &&
                    selectedTemplate?.data.profile === "large"
                  }
                  value={draft.languages[0]}
                  onChange={(e) =>
                    set("languages", [
                      e.target.value,
                      ...draft.languages.slice(1),
                    ])
                  }
                >
                  {languages.rows.map((l) => (
                    <option key={l.id} value={l.key}>
                      {nameOf(l)}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedTemplate?.data.profile !== "small" && (
                <Field label="Δεύτερη γλώσσα">
                  <select
                    disabled={
                      selectedTemplate?.data.family === "thermal" &&
                      selectedTemplate?.data.profile === "large"
                    }
                    value={draft.languages[1] || ""}
                    onChange={(e) =>
                      set(
                        "languages",
                        e.target.value
                          ? [draft.languages[0], e.target.value]
                          : [draft.languages[0]],
                      )
                    }
                  >
                    <option value="">Χωρίς δεύτερη γλώσσα</option>
                    {languages.rows
                      .filter((l) => l.key !== draft.languages[0])
                      .map((l) => (
                        <option key={l.id} value={l.key}>
                          {nameOf(l)}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </div>
            {productNeeded && (
              <>
                <div className="production-summary">
                  <span>
                    LOT{" "}
                    <b>
                      {lotOf(
                        draft,
                        selected,
                        recipes.rows.find(
                          (r) => r.key === selected?.data.recipeCode,
                        ),
                      )}
                    </b>
                  </span>
                  <span>
                    Ανάλωση έως <b>{expiryOf(draft)}</b>
                  </span>
                </div>
                <h3>Ημερομηνίες & ποσότητες</h3>
                <div className="form-grid production-values">
                  {[
                    ["productionDate", "Ημερομηνία παραγωγής"],
                    ["freezeDate", "Ημερομηνία κατάψυξης"],
                    ["expiryOverride", "Χειροκίνητη ημερομηνία λήξης"],
                  ]
                    .filter(
                      ([k]) => k !== "freezeDate" || selected?.data.frozen,
                    )
                    .map(([k, l]) => (
                      <Field key={k} label={l}>
                        <input
                          type="date"
                          value={draft[k] || ""}
                          onChange={(e) => set(k, e.target.value || null)}
                        />
                      </Field>
                    ))}
                  {[
                    ["shelfLife", "Ημέρες λήξης"],
                    ["weight", "Βάρος προϊόντος (kg)"],
                    ["pieces", "Τεμάχια / κιβώτιο"],
                    ["cartonWeight", "Βάρος κιβωτίου (kg)"],
                    ["palletWeight", "Βάρος παλέτας (kg)"],
                  ]
                    .filter(
                      ([k]) =>
                        k === "shelfLife" ||
                        k === "weight" ||
                        (k === "palletWeight" &&
                          selectedTemplate?.data.family === "pallet") ||
                        (["pieces", "cartonWeight"].includes(k) &&
                          (draft.mode === "carton" ||
                            selected?.data.smallLabelWeight === "carton" ||
                            selectedTemplate?.data.family === "pallet")),
                    )
                    .map(([k, l]) => (
                      <Field key={k} label={l}>
                        <input
                          type="number"
                          min="0"
                          max={k === "shelfLife" ? 9999 : undefined}
                          step={
                            ["shelfLife", "pieces"].includes(k) ? 1 : "0.001"
                          }
                          value={draft[k] ?? ""}
                          onChange={(e) =>
                            set(
                              k,
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </Field>
                    ))}
                </div>
                {draft.expiryOverride && (
                  <p className="hint">
                    Η λήξη έχει οριστεί χειροκίνητα και δεν υπολογίζεται από τις
                    ημέρες ζωής.
                  </p>
                )}
              </>
            )}
            <details
              className="field-group"
              open={
                !productNeeded ||
                ["20", "25", "26", "27"].includes(
                  recipes.rows.find((r) => r.key === selected?.data.recipeCode)
                    ?.data.family,
                )
              }
            >
              <summary>
                {productNeeded ? "Ιχνηλασιμότητα" : "Περιεχόμενο ετικέτας"}
              </summary>
              <div className="form-grid">
                {[
                  ["animalCode", "Κωδικός ζώου"],
                  ["slaughterhouse", "Αρ. έγκρισης σφαγείου"],
                  ["supplier", "Προμηθευτής"],
                ].map(([k, l]) => (
                  <Field key={k} label={l}>
                    <input
                      list={k + "-options"}
                      value={draft[k]}
                      onChange={(e) => set(k, e.target.value)}
                    />
                  </Field>
                ))}
                {[
                  ["slaughterhouse", "slaughterhouse"],
                  ["supplier", "supplier"],
                ].map(([key, group]) => (
                  <datalist key={key} id={key + "-options"}>
                    {references.rows
                      .filter((r) => r.data.group === group)
                      .map((r) => (
                        <option
                          key={r.id}
                          value={r.key.replace(group + ":", "")}
                        >
                          {nameOf(r)}
                        </option>
                      ))}
                  </datalist>
                ))}
                <Field label="Πελάτης">
                  <select
                    value={draft.customerId || ""}
                    onChange={(e) => set("customerId", e.target.value || null)}
                  >
                    <option value="">Επιλέξτε…</option>
                    {customers.rows.map((c) => (
                      <option key={c.id} value={c.id}>
                        {nameOf(c)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Ελεύθερο κείμενο / τίτλος">
                <textarea
                  value={draft.freeText}
                  rows={4}
                  onChange={(e) => set("freeText", e.target.value)}
                />
              </Field>
            </details>
            <div className="button-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  try {
                    const result = await api<Row>(
                      savedDraft
                        ? `/records/${savedDraft.id}`
                        : "/records/draft",
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
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Save size={16} />
                Αποθήκευση
              </button>
              <button className="primary" disabled={busy} onClick={makePreview}>
                <Eye size={17} />
                {busy ? "Προετοιμασία…" : "Προεπισκόπηση"}
              </button>
            </div>
          </div>
        </section>
        <section className="panel preview-panel">
          <div className="section-heading">
            <h2>Εκτύπωση</h2>
            <span className="count">
              {selectedTemplate?.data.widthMm} ×{" "}
              {selectedTemplate?.data.heightMm} mm
            </span>
          </div>
          <div className="preview-stage">
            {preview ? (
              <img src={preview.imageUrl} alt="Προεπισκόπηση ετικέτας" />
            ) : (
              <div className="preview-placeholder">
                <Tags size={40} />
                <p>Επιλέξτε «Προεπισκόπηση».</p>
              </div>
            )}
          </div>
          <div className="pad">
            {preview && (
              <>
                <div className="preview-meta">
                  <span>
                    LOT <b>{preview.lot || "—"}</b>
                  </span>
                  <a href={preview.pdfUrl} target="_blank" rel="noreferrer">
                    Άνοιγμα PDF <ArrowUpRight size={14} />
                  </a>
                </div>
                {preview.issues.length > 0 && (
                  <div className="validation">
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
            <div className="form-grid">
              <Field label="Εκτυπωτής">
                <select
                  value={printer}
                  onChange={(e) => setPrinter(e.target.value)}
                >
                  <option value="">Επιλέξτε εκτυπωτή…</option>
                  {printers.rows.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nameOf(p)}
                      {!p.data.validated ? " · προς επικύρωση" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Αριθμός αντιτύπων">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </Field>
            </div>
            <button
              className="primary full"
              disabled={
                !preview || preview.issues.length > 0 || !printer || busy
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await post("/jobs", {
                    previewId: preview!.id,
                    printerId: printer,
                    quantity,
                    requestKey: crypto.randomUUID(),
                  });
                  setMessage("Η εργασία προστέθηκε στην ουρά εκτύπωσης.");
                  setPreview(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Printer size={17} />
              Αποστολή για εκτύπωση
            </button>
            {message && (
              <div className="success-message">
                <Check size={17} />
                {message}
              </div>
            )}
            <p className="hint">
              Η υποβολή στην ουρά Windows δεν επιβεβαιώνει τη φυσική εκτύπωση.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
function Daily() {
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
      <section className="panel">
        <div className="toolbar">
          <Field label="Ημερομηνία παραγωγής">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setReviews([]);
              }}
            />
          </Field>
          <Field label="Εκτυπωτής μεγάλων ετικετών">
            <select
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
            </select>
          </Field>
          <button
            className="secondary"
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
          </button>
        </div>
        {order.length === 0 ? (
          <Empty>Προσθέστε είδη στην καθημερινή λίστα από τα προϊόντα.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ΣΕΙΡΑ</th>
                <th>ΠΡΟΪΟΝ</th>
                <th>ΒΑΡΟΣ (kg)</th>
                <th>ΑΝΤΙΤΥΠΑ</th>
                <th>ΕΛΕΓΧΟΣ</th>
              </tr>
            </thead>
            <tbody>
              {order.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="icon-button"
                      disabled={i === 0}
                      aria-label="Πάνω"
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={i === order.length - 1}
                      aria-label="Κάτω"
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                  </td>
                  <td>
                    <b>{nameOf(p)}</b>
                    <small>
                      {p.data.erpCode} · {p.data.secondaryCode}
                    </small>
                  </td>
                  <td>
                    <input
                      aria-label={`Βάρος ${nameOf(p)}`}
                      className="quantity"
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
                  </td>
                  <td>
                    <input
                      className="quantity"
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
                  </td>
                  <td>
                    {reviews.find((r) => r.product.id === p.id)?.submitted
                      ? "Στην ουρά"
                      : reviews.find((r) => r.product.id === p.id)?.preview
                          .issues.length || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="pad button-row">
          <button
            className="secondary"
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
          </button>
          <button
            className="primary"
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
          </button>
        </div>
        {reviews.map((r) => (
          <div className="batch-result" key={r.product.id}>
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
function Imports({ admin }: { admin: boolean }) {
  const [products, setProducts] = useState<File | null>(null),
    [recipes, setRecipes] = useState<File | null>(null),
    [review, setReview] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <>
      <Heading title="Από το Excel στο εργαστήριο." />
      {!admin ? (
        <Notice text="Η εισαγωγή δεδομένων είναι διαθέσιμη μόνο σε διαχειριστές." />
      ) : (
        <>
          <Notice text={error} />
          <div className="upload-grid">
            {[
              ["Προϊόντα", "PROIONTA.xlsx", setProducts, products],
              ["Συστάσεις", "SYNTAGES.xlsx", setRecipes, recipes],
            ].map(([title, file, set, value]) => (
              <label className="upload-card" key={String(title)}>
                <div className="upload-icon">
                  <Upload size={25} />
                </div>
                <h2>{String(title)}</h2>
                <p>{(value as File)?.name || String(file)}</p>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    (set as (f: File | null) => void)(
                      e.target.files?.[0] || null,
                    );
                    setReview(null);
                    setDone(false);
                  }}
                />
                <span className="secondary">Επιλογή αρχείου</span>
              </label>
            ))}
          </div>
          <div className="button-row">
            <button
              className="primary"
              disabled={busy || (!products && !recipes)}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const form = new FormData();
                  if (recipes) form.append("recipe", recipes);
                  if (products) form.append("product", products);
                  setReview(
                    await api("/imports", { method: "POST", body: form }),
                  );
                  setDone(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Search size={17} />
              Έλεγχος εισαγωγής
            </button>
          </div>
          {review && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>
                    {review.products} προϊόντα · {review.recipes} συστάσεις
                  </h2>
                  <p>
                    {review.issues.length} σημεία προς έλεγχο. Οι
                    προειδοποιήσεις εμποδίζουν τις επηρεαζόμενες εκτυπώσεις, όχι
                    την αποθήκευση.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    done ||
                    review.issues.some((i: Data) => i.severity === "error")
                  }
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await post(`/imports/${review.id}/commit`, {});
                      setDone(true);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {done ? <Check size={17} /> : <Save size={17} />}{" "}
                  {done ? "Ολοκληρώθηκε" : "Επιβεβαίωση εισαγωγής"}
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ΤΥΠΟΣ</th>
                      <th>ΓΡΑΜΜΗ</th>
                      <th>ΚΩΔΙΚΟΣ</th>
                      <th>ΕΛΕΓΧΟΣ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.issues.map((i: Data, n: number) => (
                      <tr key={n}>
                        <td>
                          {i.severity === "error" ? "Σφάλμα" : "Προειδοποίηση"}
                        </td>
                        <td>{i.row}</td>
                        <td>{i.key}</td>
                        <td>{i.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
function HistoryPage() {
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
        <button className="secondary" onClick={reload}>
          <RefreshCw size={16} />
          Ανανέωση
        </button>
      </Heading>
      <Notice text={error} />
      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              placeholder="Αναζήτηση LOT, προϊόντος ή χειριστή…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        {!jobs.length ? (
          <Empty>Το ιστορικό εκτυπώσεων θα εμφανιστεί εδώ.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ΕΤΙΚΕΤΑ / LOT</th>
                <th>ΗΜΕΡΟΜΗΝΙΑ</th>
                <th>ΑΝΤΙΤΥΠΑ</th>
                <th>ΚΑΤΑΣΤΑΣΗ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs
                .filter((j) =>
                  (j.snapshot + " " + j.actor)
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((j) => {
                  const s = JSON.parse(j.snapshot);
                  return (
                    <tr key={j.id}>
                      <td>
                        <b>
                          {s.content?.product?.names?.el ||
                            s.content?.template?.name ||
                            "Ετικέτα"}
                        </b>
                        <small className="mono">
                          {s.content?.lot} · {j.actor}
                        </small>
                        {j.detail && <small>{j.detail}</small>}
                      </td>
                      <td>{new Date(j.createdAt).toLocaleString("el")}</td>
                      <td>{j.quantity}</td>
                      <td>
                        <Badge status={j.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <a
                            className="text-button"
                            href={`/api/jobs/${j.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            PDF
                          </a>
                          {["uncertain", "failed", "queued"].includes(
                            j.status,
                          ) ? (
                            <button
                              className="text-button"
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
                            </button>
                          ) : (
                            !["claimed"].includes(j.status) && (
                              <button
                                className="text-button"
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
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
function Certificates() {
  const records = useRows("certificate"),
    customers = useRows("certificate-customer"),
    products = useRows("product"),
    printers = useRows("printer"),
    vehicles = useRows("vehicle"),
    recipes = useRows("recipe");
  const [savedDate, setSavedDate] = useState("");
  const [edit, setEdit] = useState<Row | null>(null),
    [data, setData] = useState<Data>({
      name: "",
      customerId: "",
      vehicle: "",
      trailer: "",
      shipmentDate: today(),
      templateKey: "certificate-bg",
      languages: ["bg"],
      lines: [],
      notes: "",
    }),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [printer, setPrinter] = useState("");
  function change(d: Data) {
    setData(d);
    setPreview(null);
  }
  return (
    <>
      <Heading title="Πιστοποιητικά" />
      <Notice text={error} />
      <div className="production-grid">
        <section className="panel pad">
          <Field label="Ημερομηνία αποθηκευμένων πιστοποιητικών">
            <input
              type="date"
              value={savedDate}
              onChange={(e) => setSavedDate(e.target.value)}
            />
          </Field>
          <Field label="Αποθηκευμένο πιστοποιητικό">
            <select
              value={edit?.id || ""}
              onChange={(e) => {
                const r = records.rows.find((r) => r.id === e.target.value);
                if (r) {
                  setEdit(r);
                  change(r.data);
                } else {
                  setEdit(null);
                  change({
                    name: "",
                    customerId: "",
                    vehicle: "",
                    trailer: "",
                    shipmentDate: today(),
                    templateKey: "certificate-bg",
                    languages: ["bg"],
                    lines: [],
                    notes: "",
                  });
                }
              }}
            >
              <option value="">Νέο πιστοποιητικό</option>
              {records.rows
                .filter(
                  (r) => !savedDate || r.updatedAt.slice(0, 10) === savedDate,
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.data.shipmentDate} · {nameOf(r)}
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Περιγραφή">
              <input
                value={data.name}
                onChange={(e) => change({ ...data, name: e.target.value })}
              />
            </Field>
            <Field label="Τύπος">
              <select
                value={data.templateKey}
                onChange={(e) =>
                  change({
                    ...data,
                    templateKey: e.target.value,
                    languages:
                      e.target.value === "certificate-bg" ? ["bg"] : ["en"],
                  })
                }
              >
                <option value="certificate-bg">Βουλγαρίας</option>
                <option value="certificate-conformance">Συμμόρφωσης</option>
              </select>
            </Field>
            <Field label="Πελάτης εξωτερικού">
              <select
                value={data.customerId}
                onChange={(e) =>
                  change({ ...data, customerId: e.target.value })
                }
              >
                <option value="">Επιλέξτε…</option>
                {customers.rows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nameOf(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ημερομηνία αποστολής">
              <input
                type="date"
                value={data.shipmentDate}
                onChange={(e) =>
                  change({ ...data, shipmentDate: e.target.value })
                }
              />
            </Field>
            {[
              ["vehicle", "Όχημα"],
              ["trailer", "Ρυμουλκούμενο"],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <input
                  list={k === "vehicle" ? "certificate-vehicles" : undefined}
                  value={data[k]}
                  onChange={(e) => change({ ...data, [k]: e.target.value })}
                />
              </Field>
            ))}
            <datalist id="certificate-vehicles">
              {vehicles.rows.map((v) => (
                <option key={v.id} value={v.data.name}>
                  {v.key}
                </option>
              ))}
            </datalist>
          </div>
          <h3>Προϊόντα αποστολής</h3>
          {data.lines.map((line: Data, i: number) => (
            <div className="certificate-line" key={i}>
              <div className="form-grid">
                <Field label="Προϊόν">
                  <select
                    value={line.productId}
                    onChange={(e) =>
                      change({
                        ...data,
                        lines: data.lines.map((r: Data, n: number) =>
                          n === i
                            ? (() => {
                                const p = products.rows.find(
                                  (p) => p.id === e.target.value,
                                );
                                const d = {
                                  ...draftFor(p || null),
                                  productionDate: r.productionDate,
                                };
                                return {
                                  ...r,
                                  productId: e.target.value,
                                  expiryDate: expiryOf(d),
                                  freezeDate: p?.data.frozen
                                    ? r.productionDate
                                    : null,
                                  lot: lotOf(
                                    d,
                                    p,
                                    recipes.rows.find(
                                      (recipe) =>
                                        recipe.key === p?.data.recipeCode,
                                    ),
                                  ),
                                };
                              })()
                            : r,
                        ),
                      })
                    }
                  >
                    <option value="">Επιλέξτε…</option>
                    {products.rows.map((p) => (
                      <option key={p.id} value={p.id}>
                        {nameOf(p)}
                      </option>
                    ))}
                  </select>
                </Field>
                {[
                  ["weight", "Καθαρό βάρος (kg)", "number"],
                  ["cartons", "Πλήθος κιβωτίων", "number"],
                  ["lot", "LOT", "text"],
                  ["productionDate", "Παραγωγή", "date"],
                  ["expiryDate", "Λήξη", "date"],
                  ["freezeDate", "Κατάψυξη", "date"],
                ].map(([k, l, type]) => (
                  <Field key={k} label={l}>
                    <input
                      type={type}
                      step={
                        k === "cartons"
                          ? "1"
                          : type === "number"
                            ? "0.001"
                            : undefined
                      }
                      value={line[k] || ""}
                      onChange={(e) =>
                        change({
                          ...data,
                          lines: data.lines.map((r: Data, n: number) =>
                            n === i
                              ? {
                                  ...r,
                                  [k]:
                                    type === "number"
                                      ? Number(e.target.value)
                                      : e.target.value || null,
                                }
                              : r,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <button
                className="text-button"
                onClick={() =>
                  change({
                    ...data,
                    lines: data.lines.filter((_: Data, n: number) => n !== i),
                  })
                }
              >
                Αφαίρεση
              </button>
            </div>
          ))}
          <button
            className="secondary"
            onClick={() =>
              change({
                ...data,
                lines: [
                  ...data.lines,
                  {
                    productId: "",
                    weight: 0,
                    lot: "",
                    productionDate: today(),
                    expiryDate: today(),
                    freezeDate: null,
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            Προσθήκη προϊόντος
          </button>
          <Field label="Σημειώσεις">
            <textarea
              rows={3}
              value={data.notes}
              onChange={(e) => change({ ...data, notes: e.target.value })}
            />
          </Field>
          <div className="button-row">
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const r = await api<Row>(
                    edit ? `/records/${edit.id}` : "/records/certificate",
                    {
                      method: edit ? "PUT" : "POST",
                      body: JSON.stringify({
                        key: edit?.key || crypto.randomUUID(),
                        version: edit?.version || 0,
                        data,
                      }),
                    },
                  );
                  setEdit(r);
                  await records.reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Save size={16} />
              Αποθήκευση
            </button>
            <button
              className="primary"
              onClick={async () => {
                try {
                  setPreview(await post("/certificates/preview", data));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Eye size={16} />
              Προεπισκόπηση
            </button>
          </div>
        </section>
        <section className="panel pad">
          {preview ? (
            <>
              <img
                className="certificate-preview"
                src={preview.imageUrl}
                alt="Προεπισκόπηση πιστοποιητικού"
              />
              <a href={preview.pdfUrl} target="_blank" rel="noreferrer">
                Άνοιγμα PDF
              </a>
              {preview.issues.map((i, n) => (
                <Notice key={n} text={i} />
              ))}
            </>
          ) : (
            <Empty>Το πιστοποιητικό θα εμφανιστεί εδώ μετά τον έλεγχο.</Empty>
          )}
          <Field label="Εκτυπωτής Α4">
            <select
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
            >
              <option value="">Επιλέξτε…</option>
              {printers.rows
                .filter((p) => p.data.widthMm >= 200)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {nameOf(p)}
                  </option>
                ))}
            </select>
          </Field>
          <button
            className="primary full"
            disabled={!preview || preview.issues.length > 0 || !printer}
            onClick={async () => {
              try {
                await post("/jobs", {
                  previewId: preview!.id,
                  printerId: printer,
                  quantity: 1,
                  requestKey: crypto.randomUUID(),
                });
                setPreview(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Printer size={16} />
            Εκτύπωση πιστοποιητικού
          </button>
        </section>
      </div>
    </>
  );
}
function SettingsPage({ admin }: { admin: boolean }) {
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
    <>
      <div className="tabs">
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
          <button
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
            key={k}
          >
            {l}
          </button>
        ))}
      </div>
      <Notice text={error} />
      {tab === "backup" ? (
        <section className="panel pad">
          <h2>Αντίγραφα ασφαλείας</h2>
          <p>
            {backup?.enabled
              ? `Αυτόματο αντίγραφο στις ${backup.hour}:00 · Διατήρηση ${backup.retentionDays} ημέρες`
              : "Τα αυτόματα αντίγραφα δεν είναι ενεργοποιημένα."}
          </p>
          <button
            className="primary"
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
          </button>
          {backup?.recent?.map((item: Data, i: number) => (
            <div className="setting-row" key={i}>
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
        <section className="panel pad">
          <h2>Λογαριασμοί</h2>
          <form
            className="form-grid"
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
              <input name="name" required />
            </Field>
            <Field label="Κωδικός (12+ χαρακτήρες)">
              <input name="password" type="password" minLength={12} required />
            </Field>
            <Field label="Ρόλος">
              <select name="role">
                <option value="operator">Χειριστής</option>
                <option value="admin">Διαχειριστής</option>
              </select>
            </Field>
            <button className="primary">Προσθήκη</button>
          </form>
          {users.map((u) => (
            <div className="setting-row" key={u.id}>
              <b>{u.name}</b>
              <span>{u.role}</span>
              <button
                className="secondary"
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
              </button>
            </div>
          ))}
        </section>
      ) : tab === "agents" ? (
        <section className="panel pad">
          <h2>Σύνδεση βοηθού εκτύπωσης</h2>
          <p>
            Συνδέστε τον υπολογιστή που έχει πρόσβαση στις ουρές των εκτυπωτών.
          </p>
          <button
            className="primary"
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
          </button>
          {token && (
            <div className="validation">
              <b>Αποθηκεύστε το κλειδί στον βοηθό. Εμφανίζεται μόνο τώρα.</b>
              <pre>{token}</pre>
            </div>
          )}
          {agents.map((a) => (
            <div className="setting-row" key={a.id}>
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
        <section className="panel">
          <table>
            <thead>
              <tr>
                <th>ΧΡΟΝΟΣ</th>
                <th>ΧΡΗΣΤΗΣ</th>
                <th>ΕΝΕΡΓΕΙΑ</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.at).toLocaleString("el")}</td>
                  <td>{a.actor}</td>
                  <td>{a.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
