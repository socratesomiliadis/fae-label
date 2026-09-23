import { menus } from "@/app/navigation";
import { FaethonLogo } from "@/components/brand/faethon-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { User } from "@/types/records";
import { LogOut } from "lucide-react";

type AppSidebarProps = {
  user: User;
  page: string;
  navigate: (page: string) => void;
  onLogout: () => void;
};

export function AppSidebar({
  user,
  page,
  navigate,
  onLogout,
}: AppSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r bg-card px-2 py-4 md:w-60 md:px-4 md:py-6">
      <a
        href="#"
        aria-label="ΦΑΕΘΩΝ — Επισκόπηση"
        onClick={(event) => {
          event.preventDefault();
          navigate("dashboard");
        }}
        className="flex flex-col items-center gap-3 rounded-xl bg-primary px-2 py-4 md:py-5"
      >
        <FaethonLogo className="h-11 md:h-24" />
        <span className="hidden text-[10px] tracking-[0.25em] text-primary-foreground md:block">
          LABEL STUDIO
        </span>
      </a>
      <nav
        aria-label="Κύρια πλοήγηση"
        className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto"
      >
        {menus
          .filter(
            ([key]) =>
              user.role === "admin" ||
              !["settings", "imports", "template"].includes(key),
          )
          .map(([key, label, Icon]) => (
            <Button
              key={key}
              variant="ghost"
              title={label}
              aria-label={label}
              aria-current={page === key ? "page" : undefined}
              onClick={() => navigate(key)}
              className={cn(
                "h-10 w-full justify-center gap-3 px-2 text-xs text-muted-foreground md:justify-start md:px-3",
                page === key && "bg-secondary font-semibold text-primary",
              )}
            >
              <Icon className="size-4.5" />
              <span className="hidden md:inline">{label}</span>
            </Button>
          ))}
      </nav>
      <div className="mt-4 flex flex-col items-center gap-2 border-t pt-4 md:flex-row">
        <div className="hidden size-8 shrink-0 place-items-center rounded-full bg-secondary font-semibold text-primary md:grid">
          {user.name[0]?.toUpperCase()}
        </div>
        <div className="hidden min-w-0 flex-1 md:block">
          <b className="block truncate text-xs">{user.name}</b>
          <small>{user.role === "admin" ? "Διαχειριστής" : "Χειριστής"}</small>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Αποσύνδεση"
          onClick={onLogout}
        >
          <LogOut />
        </Button>
      </div>
    </aside>
  );
}
