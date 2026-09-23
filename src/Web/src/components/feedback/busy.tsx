import { LoaderCircle } from "lucide-react";

export function Busy() {
  return (
    <div className="flex items-center justify-center gap-2.5 p-16 text-muted-foreground">
      <LoaderCircle
        size={22}
        className="animate-spin motion-reduce:animate-none"
      />{" "}
      Φόρτωση…
    </div>
  );
}
