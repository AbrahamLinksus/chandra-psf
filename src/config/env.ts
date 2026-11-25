// Public sample value from .env.example; used whenever NODE_ENV is not "production" (local dev and unit tests, incl. "test"), so `pnpm dev` works without a .env.
const DEV_FALLBACK_DEALER_PHONE = "+91 44 0000 0000";

/** Plain checks (no schema library): this module loads on every page and the strict CSP blocks eval-style probes. */
function requireNonEmpty(name: string, value: string | undefined): string {
  if (value === undefined || value === "") {
    throw new Error(`Invalid environment: ${name} is required and must be a non-empty string`);
  }
  return value;
}

/** .env.example placeholders for the contact keys (D-37). Exported so the go-live check can flag them. */
export const CONTACT_PLACEHOLDERS = {
  NEXT_PUBLIC_COMPANY_NAME: "Your Company Name",
  NEXT_PUBLIC_PRIVACY_PHONE: "+91 00 0000 0000",
  NEXT_PUBLIC_PRIVACY_EMAIL: "privacy@example.com",
} as const;

/** Unset or empty falls back to the placeholder in every environment (never throws). */
const orPlaceholder = (value: string | undefined, placeholder: string) =>
  value === undefined || value === "" ? placeholder : value;

const dealerPhone =
  process.env.NEXT_PUBLIC_DEALER_PHONE ??
  (process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK_DEALER_PHONE);

/** The only module that reads process.env (LLD 0.5). Literal accesses so Next inlines them. */
export const env = {
  NEXT_PUBLIC_DEALER_PHONE: requireNonEmpty("NEXT_PUBLIC_DEALER_PHONE", dealerPhone),
  NEXT_PUBLIC_COMPANY_NAME: orPlaceholder(
    process.env.NEXT_PUBLIC_COMPANY_NAME,
    CONTACT_PLACEHOLDERS.NEXT_PUBLIC_COMPANY_NAME,
  ),
  NEXT_PUBLIC_PRIVACY_PHONE: orPlaceholder(
    process.env.NEXT_PUBLIC_PRIVACY_PHONE,
    CONTACT_PLACEHOLDERS.NEXT_PUBLIC_PRIVACY_PHONE,
  ),
  NEXT_PUBLIC_PRIVACY_EMAIL: orPlaceholder(
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL,
    CONTACT_PLACEHOLDERS.NEXT_PUBLIC_PRIVACY_EMAIL,
  ),
};

const DEFAULT_POLL_SECONDS = 30;

/** Poll cadence in seconds (LLD §20). Missing, non-numeric or <= 0 values fall back to 30. */
function parsePollSeconds(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) && n > 0
    ? n
    : DEFAULT_POLL_SECONDS;
}

export const POLL_SECONDS = parsePollSeconds(process.env.NEXT_PUBLIC_POLL_SECONDS);

export type Env = typeof env;

/** True only under `next dev`; the CSP in src/proxy.ts relaxes eval and websockets for HMR then. */
export const isDevelopment = process.env.NODE_ENV === "development";
