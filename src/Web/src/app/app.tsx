import { Busy } from "@/components/feedback/busy";
import { Notice } from "@/components/feedback/notice";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Login } from "@/features/auth/login-page";
import { LabelContentPage } from "@/features/catalog/label-content-page";
import { Catalog } from "@/features/catalog/catalog-page";
import { Dashboard } from "@/features/dashboard/dashboard-page";
import { useSession } from "@/features/auth/use-session";
import { type Row } from "@/types/records";
import { lazy, Suspense, useState } from "react";
import { SWRConfig } from "swr";

const ProductionPage = lazy(() =>
  import("@/features/production/production-page").then((module) => ({
    default: module.ProductionPage,
  })),
);
const Certificates = lazy(() =>
  import("@/features/certificates/certificates-page").then((module) => ({
    default: module.Certificates,
  })),
);
const Daily = lazy(() =>
  import("@/features/daily/daily-page").then((module) => ({
    default: module.Daily,
  })),
);
const HistoryPage = lazy(() =>
  import("@/features/history/history-page").then((module) => ({
    default: module.HistoryPage,
  })),
);
const Imports = lazy(() =>
  import("@/features/imports/imports-page").then((module) => ({
    default: module.Imports,
  })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings/settings-page").then((module) => ({
    default: module.SettingsPage,
  })),
);

// Discard cached master data when the authenticated workspace unmounts.
const cacheConfig = { provider: () => new Map() };

export function App() {
  const { user, ready, offline, error, login, logout } = useSession();
  const [page, setPage] = useState("dashboard");
  const [selected, setSelected] = useState<Row | null>(null);
  if (!ready) return <Busy />;
  if (!user)
    return (
      <Login
        onLogin={(value) => {
          setPage("dashboard");
          setSelected(null);
          login(value);
        }}
      />
    );
  const nav = (next: string) => {
    setPage(next);
    if (next !== "production") setSelected(null);
  };
  return (
    <SWRConfig key={user.name} value={cacheConfig}>
      <div className="flex min-h-screen">
        <AppSidebar user={user} page={page} navigate={nav} onLogout={logout} />
        <main className="ml-16 flex min-h-screen min-w-0 flex-1 flex-col md:ml-60">
          <AppHeader page={page} offline={offline} />
          <div className="mx-auto w-full max-w-[1690px] flex-1 p-4 md:p-7 xl:p-10">
            <Notice text={error} />
            {offline && (
              <Notice text="Δεν υπάρχει σύνδεση με τον διακομιστή. Οι εκτυπώσεις δεν μπορούν να υποβληθούν." />
            )}
            <Suspense fallback={<Busy />}>
              {page === "dashboard" ? (
                <Dashboard navigate={nav} />
              ) : [
                  "production",
                  "sample",
                  "custom",
                  "butcher",
                  "production-label",
                ].includes(page) ? (
                <ProductionPage
                  key={page + (selected?.id || "")}
                  initial={selected}
                  workflow={page}
                />
              ) : page === "label-content" ? (
                <LabelContentPage admin={user.role === "admin"} />
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
            </Suspense>
          </div>
        </main>
      </div>
    </SWRConfig>
  );
}
