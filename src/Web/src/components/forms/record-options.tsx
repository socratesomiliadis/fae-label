import { nameOf } from "@/lib/records";
import type { Row } from "@/types/records";

export function RecordOptions({
  value,
  rows,
  prefix = "",
}: {
  value?: string;
  rows: Row[];
  prefix?: string;
}) {
  const keyOf = (row: Row) =>
    row.key.startsWith(prefix) ? row.key.slice(prefix.length) : row.key;
  return (
    <>
      <option value="">Επιλέξτε…</option>
      {value && !rows.some((row) => keyOf(row) === value) && (
        <option value={value}>{value}</option>
      )}
      {rows.map((row) => (
        <option key={row.id} value={keyOf(row)}>
          {keyOf(row)} · {nameOf(row)}
        </option>
      ))}
    </>
  );
}
