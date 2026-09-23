import { cn } from "@/lib/utils";

/** Original, unmodified cream logo; always display on a burgundy surface. */
export function FaethonLogo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/faethon-logo.svg"
      alt="ΦΑΕΘΩΝ"
      width={202}
      height={251}
      className={cn("h-20 w-auto shrink-0", className)}
    />
  );
}
