import { SESSION_MAX_DAYS } from "@/domain/constants";
import type { SessionCookies } from "../ctx";

export const SESSION_COOKIE_PROD = "__Host-psf_session";
export const SESSION_COOKIE_DEV = "psf_session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_MAX_DAYS * 24 * 60 * 60;

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

/** The part of Next's `await cookies()` store this module uses. */
export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: SessionCookieOptions): unknown;
}

export function sessionCookieName(production: boolean): string {
  return production ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}

/** `__Host-` requires Secure, Path=/ and no Domain. */
export function sessionCookieOptions(production: boolean, maxAge: number): SessionCookieOptions {
  return { httpOnly: true, secure: production, sameSite: "lax", path: "/", maxAge };
}

/** `SessionCookies` over a Next cookie store. `production` is VERCEL_ENV === "production". */
export function createNextSessionCookies(
  store: CookieStoreLike,
  production: boolean,
): SessionCookies {
  const name = sessionCookieName(production);
  return {
    get: () => store.get(name)?.value,
    set: (token) => {
      store.set(name, token, sessionCookieOptions(production, SESSION_COOKIE_MAX_AGE_SECONDS));
    },
    clear: () => {
      store.set(name, "", sessionCookieOptions(production, 0));
    },
  };
}
