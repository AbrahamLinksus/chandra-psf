/** Reads a required variable; the error names it but never prints any value. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set. See tests/e2e/preview/README.md for the runbook.`);
  }
  return value;
}

/** The preview's origin, without a trailing slash. */
export function previewUrl(): string {
  const raw = requireEnv("PREVIEW_URL");
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error("PREVIEW_URL is not a valid URL (expected https://<name>.vercel.app)");
  }
}

/** The main admin's sign-in. The password is only ever held in memory. */
export function adminLogin(): { email: string; password: string } {
  return {
    email: requireEnv("PREVIEW_ADMIN_EMAIL"),
    password: requireEnv("PREVIEW_ADMIN_PASSWORD"),
  };
}
