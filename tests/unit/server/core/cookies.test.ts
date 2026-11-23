// @vitest-environment node
import { describe, expect, it } from "vitest";
import { must } from "../../../support/serverCtx";
import {
  createNextSessionCookies,
  sessionCookieName,
  sessionCookieOptions,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  type CookieStoreLike,
} from "@/server/auth/cookies";

function fakeStore() {
  const calls: { name: string; value: string; options: unknown }[] = [];
  const map = new Map<string, string>();
  const store: CookieStoreLike = {
    get: (n) => (map.has(n) ? { value: map.get(n) ?? "" } : undefined),
    set: (name, value, options) => {
      calls.push({ name, value, options });
      map.set(name, value);
    },
  };
  return { store, calls };
}

describe("session cookie", () => {
  it("production: __Host- name, httpOnly, Secure, SameSite=Lax, Path=/, 7 days", () => {
    expect(sessionCookieName(true)).toBe("__Host-psf_session");
    const { store, calls } = fakeStore();
    createNextSessionCookies(store, true).set("tok");
    expect(calls[0]).toEqual({
      name: "__Host-psf_session",
      value: "tok",
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 604_800 },
    });
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(7 * 24 * 3600);
  });

  it("development: plain name and not Secure", () => {
    expect(sessionCookieName(false)).toBe("psf_session");
    expect(sessionCookieOptions(false, 5).secure).toBe(false);
  });

  it("get reads, clear expires the cookie", () => {
    const { store, calls } = fakeStore();
    const c = createNextSessionCookies(store, true);
    expect(c.get()).toBeUndefined();
    c.set("tok");
    expect(c.get()).toBe("tok");
    c.clear();
    expect(calls[1]).toMatchObject({ name: "__Host-psf_session", value: "" });
    expect((must(calls[1]).options as { maxAge: number }).maxAge).toBe(0);
  });
});
