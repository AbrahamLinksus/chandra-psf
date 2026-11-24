import type { Metadata } from "next";
import Script from "next/script";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Chandra Honda PSF",
  robots: "noindex",
};

/**
 * Hands the request nonce to libraries that inject <style> tags. Browsers expose a nonce only through
 * the element's .nonce property, so it is copied from the first parser-inserted nonced script (this
 * <Script> itself is re-inserted by the Next client without a nonce).
 */
const STYLE_NONCE_SCRIPT =
  "window.__webpack_nonce__=Array.from(document.scripts,function(s){return s.nonce}).find(Boolean);";

export default async function RootLayout({ children }: { children: ReactNode }) {
  /*
   * CSP trade-off (T-31s): every page is rendered per request, none is static.
   * - Why: Next 16 can only stamp the per-request CSP nonce (src/proxy.ts) onto its scripts when the
   *   page renders dynamically, so connection() opts the whole app out of static prerendering.
   * - Cost: no static/ISR/CDN-cached pages and no PPR; every page view runs a server render
   *   (one function call on Vercel). Acceptable here: every screen is a client component that loads
   *   its data at runtime through RPC (the static shells held almost nothing), the app is internal,
   *   low traffic and `noindex`.
   * - Rejected: hash/SRI-based CSP (experimental in Next 16 and Next's inline flight-data scripts
   *   cannot be hashed at build time), and dropping the nonce (needs script-src 'unsafe-inline',
   *   which defeats the policy). nonce + 'strict-dynamic' is the only strict option that keeps
   *   Next's runtime-loaded chunks working.
   * - Maintenance: <style> elements that libraries inject at runtime must carry the nonce or be
   *   allowed by hash. sonner is allowed by hash (SONNER_STYLE_HASHES in src/proxy.ts): re-derive
   *   the hashes from the console error after a sonner upgrade. Radix overlays (Sheet, Dialog,
   *   AlertDialog, Select, Popover, DropdownMenu) inject a scroll-lock <style> through
   *   react-remove-scroll-bar / react-style-singleton, which reads the nonce from the global
   *   `__webpack_nonce__` (via get-nonce); the inline <Script> below sets it from its own nonce
   *   (Next stamps the request nonce on it). A hash is not an option there: that CSS embeds the
   *   measured scrollbar width, so it differs per device.
   *   The csp e2e spec fails on any violation, so a library upgrade that breaks this is caught.
   */
  await connection();
  return (
    <html lang="en">
      <head>
        <Script id="csp-style-nonce" strategy="beforeInteractive">
          {STYLE_NONCE_SCRIPT}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
