// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { clientIp } from "@/server/rpc/context";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve({}) }));

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop, then x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
