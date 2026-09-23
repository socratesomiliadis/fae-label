export type Row<T = Data> = {
  id: string;
  kind: string;
  key: string;
  version: number;
  updatedAt: string;
  data: T;
};
export type Data = Record<string, any>;
export type Preview = {
  id: string;
  pdfUrl: string;
  imageUrl: string;
  issues: string[];
  lot: string;
  expiry: string;
};
export type User = { name: string; role: string };
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "X-Faethon-Request": "1",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.message ||
        (response.status === 401
          ? "Χρειάζεται σύνδεση."
          : response.status === 403
            ? "Δεν έχετε δικαίωμα για αυτή την ενέργεια."
            : `Σφάλμα ${response.status}`),
    );
  }
  return response.status === 204
    ? (undefined as T)
    : response.json().catch(() => undefined);
}
export const post = <T = any>(path: string, value: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(value) });
export function today(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (type: string) => parts.find((p) => p.type === type)?.value;
  const d = new Date(`${v("year")}-${v("month")}-${v("day")}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export const nameOf = (r: Row) =>
  r.data.names?.el || r.data.name || r.data.code || r.key;
export const statuses: Record<string, string> = {
  queued: "Στην ουρά",
  claimed: "Υποβολή",
  submitted: "Στάλθηκε στην ουρά Windows",
  uncertain: "Απαιτείται έλεγχος",
  failed: "Αποτυχία",
  cancelled: "Ακυρώθηκε",
  confirmed: "Ελέγχθηκε",
};
