import { menus } from "@/app/navigation";
import { cn } from "@/lib/utils";

const workflowTitles: Record<string, string> = {
  sample: "Δείγμα",
  custom: "Ελεύθερη ετικέτα",
  butcher: "Κρεοπωλείο",
  "production-label": "Προς παραγωγή",
};
const dateFormat = new Intl.DateTimeFormat("el", {
  dateStyle: "long",
  timeZone: "Europe/Athens",
});

export function AppHeader({
  page,
  offline,
}: {
  page: string;
  offline: boolean;
}) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b bg-card/80 px-4 md:px-7 xl:px-10">
      <span className="text-xs font-medium">
        {menus.find(([key]) => key === page)?.[1] || workflowTitles[page]}
      </span>
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <span
          role="status"
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-1.5",
            offline
              ? "bg-amber-50 text-amber-800"
              : "bg-emerald-50 text-emerald-800",
          )}
        >
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
          {offline ? "Χωρίς σύνδεση" : "Συνδεδεμένο"}
        </span>
        <span className="hidden xl:inline">
          {dateFormat.format(new Date())}
        </span>
      </div>
    </header>
  );
}
