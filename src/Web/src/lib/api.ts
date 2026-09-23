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
