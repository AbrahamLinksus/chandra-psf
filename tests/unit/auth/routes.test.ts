// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { guardRedirect } from "@/components/shared/RoleGuard";
import { landingPath, postSignInPath, safeNext, signInUrl } from "@/features/auth/routes";
import { proxy } from "@/proxy";
import { makeUser } from "../../support/fakeDataAccess";

describe("sign-in redirects (AC-6)", () => {
  it("signInUrl carries the ended notice and a safe next, and drops an unsafe one", () => {
    expect(signInUrl("/admin/users?x=1", true)).toBe(
      "/sign-in?ended=1&next=%2Fadmin%2Fusers%3Fx%3D1",
    );
    expect(signInUrl(null, false)).toBe("/sign-in");
    expect(signInUrl("//evil.test", true)).toBe("/sign-in?ended=1");
    expect(signInUrl("/\\evil.test", false)).toBe("/sign-in");
  });

  it("safeNext accepts only same-origin relative paths", () => {
    expect(safeNext("/support/new")).toBe("/support/new");
    for (const bad of [null, "https://evil.test", "//evil.test", "admin", "/a\\b", "/a\nb"]) {
      expect(safeNext(bad)).toBeNull();
    }
  });

  it("after sign-in returns to the same page when the role may open it, else the landing page", () => {
    const admin = makeUser("main_admin");
    const support = makeUser("support");
    expect(postSignInPath(admin, "/admin/audit")).toBe("/admin/audit");
    expect(postSignInPath(support, "/admin/audit")).toBe("/support");
    expect(postSignInPath(admin, null)).toBe("/admin");
    expect(postSignInPath(admin, "/account")).toBe("/account");
    expect(postSignInPath(makeUser("support", { mustSetPassword: true }), "/admin")).toBe(
      "/set-password",
    );
    expect(landingPath(support)).toBe("/support");
  });

  it("guardRedirect sends a visitor without a session to sign-in with the notice and the page", () => {
    expect(guardRedirect(null, ["support"], "/support/new")).toBe(
      "/sign-in?ended=1&next=%2Fsupport%2Fnew",
    );
  });
});

describe("proxy: no cookie means redirect to /sign-in?next=", () => {
  const req = (path: string, cookie?: string) =>
    new NextRequest(`http://app.test${path}`, cookie ? { headers: { cookie } } : undefined);

  it("redirects with the requested path and query", () => {
    const res = proxy(req("/admin/users?tab=2"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://app.test/sign-in?next=%2Fadmin%2Fusers%3Ftab%3D2",
    );
  });

  it("lets a request with the session cookie through (dev and production names)", () => {
    for (const c of ["psf_session=abc", "__Host-psf_session=abc"]) {
      expect(proxy(req("/support", c)).headers.get("location")).toBeNull();
    }
  });
});
