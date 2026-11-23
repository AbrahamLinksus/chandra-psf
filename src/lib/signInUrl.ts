/** Accepts only same-origin relative paths; anything else (absolute URL, `//host`, `/\host`) is null. */
export function safeNext(raw: string | null): string | null {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return null;
  return raw;
}

/** The sign-in URL for a visitor who has no (or no longer a) session. */
export function signInUrl(from: string | null, ended: boolean): string {
  const params = new URLSearchParams();
  if (ended) params.set("ended", "1");
  const next = safeNext(from);
  if (next !== null) params.set("next", next);
  const query = params.toString();
  return query === "" ? "/sign-in" : `/sign-in?${query}`;
}
