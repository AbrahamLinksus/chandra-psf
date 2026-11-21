import { describe, expect, it } from "vitest";
import { landingPath } from "@/features/auth/routes";
import { passwordProblem } from "@/features/auth/useSetPassword";
import type { User } from "@/domain/types";

const user = (over: Partial<User>): User => ({
  id: "u",
  name: "U",
  email: "u@x.y",
  role: "support",
  active: true,
  mustSetPassword: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("set-password client rules (G-05)", () => {
  it("under 8 characters is refused", () => {
    expect(passwordProblem("short12", "short12")).toBe("Use at least 8 characters");
  });

  it("a mismatch is refused", () => {
    expect(passwordProblem("longenough1", "longenough2")).toBe("The two passwords don't match");
  });

  it("8 matching characters pass", () => {
    expect(passwordProblem("12345678", "12345678")).toBeNull();
  });
});

describe("landing path (F-1)", () => {
  it("support goes to /support, admin to /admin, mustSetPassword to /set-password", () => {
    expect(landingPath(user({}))).toBe("/support");
    expect(landingPath(user({ role: "admin" }))).toBe("/admin");
    expect(landingPath(user({ mustSetPassword: true }))).toBe("/set-password");
  });
});
