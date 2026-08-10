/** Tiny typed fetch wrapper shared by client code (the store + admin panel). */
export async function api<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(url, {
    ...rest,
    headers: json
      ? { "Content-Type": "application/json", ...(rest.headers ?? {}) }
      : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
