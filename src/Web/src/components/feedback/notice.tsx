import { AlertTriangle } from "lucide-react";

export function Notice({ text }: { text: string }) {
  return text ? (
    <div
      className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-amber-900 [&_svg]:mt-0.5 [&_svg]:shrink-0"
      role="alert"
    >
      <AlertTriangle size={17} />
      <span>{text}</span>
    </div>
  ) : null;
}
