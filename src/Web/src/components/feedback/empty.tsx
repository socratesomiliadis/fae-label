import { Layers } from "lucide-react";
import React from "react";

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center p-10 text-center text-muted-foreground [&_p]:mt-4 [&_p]:max-w-md [&_p]:text-sm">
      <Layers size={32} />
      <p>{children}</p>
    </div>
  );
}
