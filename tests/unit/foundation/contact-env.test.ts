import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const FEATURES = ["feedback-form", "privacy"] as const;
const loaders = {
  "feedback-form": () => import("@/features/feedback-form/contact"),
  privacy: () => import("@/features/privacy/contact"),
};

describe("feature contact modules read the shared env source (D-37)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(FEATURES)("%s/contact.ts shows the env values", async (feature) => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_COMPANY_NAME", "Acme Motors");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_PHONE", "+91 11 2222 3333");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "dpo@acme.test");
    const c = await loaders[feature]();
    expect(c.COMPANY_NAME).toBe("Acme Motors");
    expect(c.HEAD_OFFICE_PHONE).toBe("+91 11 2222 3333");
    expect(c.HEAD_OFFICE_EMAIL).toBe("dpo@acme.test");
  });

  it.each(FEATURES)("%s/contact.ts falls back to the placeholders when unset", async (feature) => {
    vi.resetModules();
    for (const k of ["COMPANY_NAME", "PRIVACY_PHONE", "PRIVACY_EMAIL"]) {
      vi.stubEnv(`NEXT_PUBLIC_${k}`, undefined);
    }
    const c = await loaders[feature]();
    expect(c.COMPANY_NAME).toBe("Your Company Name");
    expect(c.HEAD_OFFICE_PHONE).toBe("+91 00 0000 0000");
    expect(c.HEAD_OFFICE_EMAIL).toBe("privacy@example.com");
  });

  it.each(FEATURES)("%s/contact.ts holds no duplicated literal constants", (feature) => {
    const src = readFileSync(`src/features/${feature}/contact.ts`, "utf8");
    expect(src).toContain('from "@/config/env"');
    expect(src).not.toMatch(/=\s*["'`]/);
  });
});
