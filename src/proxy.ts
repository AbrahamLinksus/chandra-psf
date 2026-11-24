import { NextResponse, type NextRequest } from "next/server";
import { isDevelopment } from "@/config/env";
import { SESSION_COOKIE_DEV, SESSION_COOKIE_PROD } from "@/server/auth/cookies";

const SONNER_STYLE_HASHES =
  "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='";

const PROTECTED = /^\/(admin|support)(\/|$)|^\/(account|set-password)$/;

/** Strict same-origin CSP with a per-request nonce (Next 16 CSP guide). Dev adds eval and websocket for HMR only. */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // sonner injects two <style> elements at runtime without a nonce; allowed by hash (re-derive from the console error if sonner is upgraded).
    `style-src-elem 'self' 'nonce-${nonce}' ${SONNER_STYLE_HASHES}`,
    // Nonces cannot cover style="" attributes (React style props, chart/progress widgets); scoped to attributes only.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function withCsp(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDevelopment);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/** Sets the CSP on every page. For protected routes it also checks cookie presence only: never opens the DB. Prefetches skip the proxy (matcher `missing`), so they get no redirect; fine, it is not a security boundary, every RPC and RoleGuard re-checks (LLD §18.5). */
export function proxy(request: NextRequest): NextResponse {
  const { cookies, nextUrl } = request;
  const hasSession = cookies.has(SESSION_COOKIE_PROD) || cookies.has(SESSION_COOKIE_DEV);
  if (PROTECTED.test(nextUrl.pathname) && !hasSession) {
    const target = new URL("/sign-in", request.url);
    target.searchParams.set("next", `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(target);
  }
  return withCsp(request);
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
