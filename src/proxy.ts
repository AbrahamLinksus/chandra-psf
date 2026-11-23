import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_DEV, SESSION_COOKIE_PROD } from "@/server/auth/cookies";

/** Cookie presence only: never opens the DB (runs on prefetches). Not a security boundary, every RPC re-checks (LLD §18.5). */
export function proxy(request: NextRequest): NextResponse {
  const { cookies, nextUrl } = request;
  if (cookies.has(SESSION_COOKIE_PROD) || cookies.has(SESSION_COOKIE_DEV)) {
    return NextResponse.next();
  }
  const target = new URL("/sign-in", request.url);
  target.searchParams.set("next", `${nextUrl.pathname}${nextUrl.search}`);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/admin/:path*", "/support/:path*", "/account", "/set-password"],
};
