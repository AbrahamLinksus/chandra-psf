// Import first: gives src/config/env.ts its three public demo keys (same values as .env.example).
process.env["NEXT_PUBLIC_DEMO_PASSWORD"] ??= "Demo@2026";
if (!process.env["NEXT_PUBLIC_APP_URL"]) process.env["NEXT_PUBLIC_APP_URL"] = ""; // empty = links use the page origin
process.env["NEXT_PUBLIC_DEALER_PHONE"] ??= "+91 44 0000 0000";
