import type { Row } from "@/types/records";
export const nameOf = (r: Row) =>
  r.data.names?.el || r.data.name || r.data.code || r.key;
