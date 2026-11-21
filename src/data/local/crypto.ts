/** SHA-256 hex digest. Demo only: this is not password storage fit for production. */
export async function hashPassword(pw: string): Promise<string> {
  const bytes = new TextEncoder().encode(pw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
