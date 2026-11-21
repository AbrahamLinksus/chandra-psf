import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_DEMO_PASSWORD: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().optional(), // falls back to window.location.origin (LLD 0.5)
  NEXT_PUBLIC_DEALER_PHONE: z.string().min(1),
});

/** The only module that reads process.env (LLD 0.5). Literal accesses so Next inlines them. */
export const env = EnvSchema.parse({
  NEXT_PUBLIC_DEMO_PASSWORD: process.env.NEXT_PUBLIC_DEMO_PASSWORD,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_DEALER_PHONE: process.env.NEXT_PUBLIC_DEALER_PHONE,
});

export type Env = z.infer<typeof EnvSchema>;
