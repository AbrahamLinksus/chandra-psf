import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_DEALER_PHONE: z.string().min(1),
});

// Public sample value from .env.example; used whenever NODE_ENV is not "production" (local dev and unit tests, incl. "test"), so `pnpm dev` works without a .env.
const DEV_FALLBACK = {
  NEXT_PUBLIC_DEALER_PHONE: "+91 44 0000 0000",
} as const;

const fallback = process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK;

/** The only module that reads process.env (LLD 0.5). Literal accesses so Next inlines them. */
export const env = EnvSchema.parse({
  NEXT_PUBLIC_DEALER_PHONE:
    process.env.NEXT_PUBLIC_DEALER_PHONE ?? fallback?.NEXT_PUBLIC_DEALER_PHONE,
});

const DEFAULT_POLL_SECONDS = 30;

/** Poll cadence in seconds (LLD §20). Missing, non-numeric or <= 0 values fall back to 30. */
function parsePollSeconds(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) && n > 0
    ? n
    : DEFAULT_POLL_SECONDS;
}

export const POLL_SECONDS = parsePollSeconds(process.env.NEXT_PUBLIC_POLL_SECONDS);

export type Env = z.infer<typeof EnvSchema>;

/** True only under `next dev`; the CSP in src/proxy.ts relaxes eval and websockets for HMR then. */
export const isDevelopment = process.env.NODE_ENV === "development";
