import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_DEMO_PASSWORD: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().optional(), // falls back to window.location.origin (LLD 0.5)
  NEXT_PUBLIC_DEALER_PHONE: z.string().min(1),
});

// Public sample values from .env.example; used whenever NODE_ENV is not "production" (local dev and unit tests, incl. "test"), so `pnpm dev` works without a .env.
const DEV_FALLBACK = {
  NEXT_PUBLIC_DEMO_PASSWORD: "Demo@2026",
  NEXT_PUBLIC_APP_URL: "https://psf-demo.vercel.app",
  NEXT_PUBLIC_DEALER_PHONE: "+91 44 0000 0000",
} as const;

const fallback = process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK;

/** The only module that reads process.env (LLD 0.5). Literal accesses so Next inlines them. */
export const env = EnvSchema.parse({
  NEXT_PUBLIC_DEMO_PASSWORD:
    process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? fallback?.NEXT_PUBLIC_DEMO_PASSWORD,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? fallback?.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_DEALER_PHONE:
    process.env.NEXT_PUBLIC_DEALER_PHONE ?? fallback?.NEXT_PUBLIC_DEALER_PHONE,
});

export type Env = z.infer<typeof EnvSchema>;
