import { statuses } from "@/features/history/job-statuses";
import { Badge as UiBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Badge({ status }: { status: string }) {
  return (
    <UiBadge
      variant="secondary"
      className={cn(
        "h-auto py-1",
        status === "uncertain" || status === "failed"
          ? "bg-amber-50 text-amber-800"
          : status === "submitted" || status === "confirmed"
            ? "bg-emerald-50 text-emerald-800"
            : "bg-muted text-muted-foreground",
      )}
    >
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
      {statuses[status] || status}
    </UiBadge>
  );
}
