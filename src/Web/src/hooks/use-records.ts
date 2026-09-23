import { api } from "@/lib/api";
import { type Row } from "@/types/records";
import { useCallback } from "react";
import useSWR from "swr";

const emptyRows: Row[] = [];
const fetchRecords = (path: string) => api<Row[]>(path);

/** Share lookup requests across screens and ignore obsolete request results. */
export function useRows(kind: string) {
  const { data, error, isLoading, mutate } = useSWR(
    kind ? `/records/${kind}` : null,
    fetchRecords,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const reload = useCallback(async () => {
    await mutate();
  }, [mutate]);
  return {
    rows: data ?? emptyRows,
    error: error?.message ?? "",
    loading: isLoading,
    reload,
  };
}
