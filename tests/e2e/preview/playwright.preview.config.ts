import { defineConfig, devices } from "@playwright/test";

// Runs only against the deployed preview, by the owner. No web server and no local database.
// A missing PREVIEW_URL fails fast with a clear message.
const url = process.env["PREVIEW_URL"];
if (url === undefined || url === "") {
  throw new Error("PREVIEW_URL is not set. See tests/e2e/preview/README.md for the runbook.");
}

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.preview\.ts/,
  outputDir: "../../../.results/T-23/playwright",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: new URL(url).origin,
    viewport: { width: 1440, height: 900 },
    // Sign-in calls carry the owner's password: never record traces, video or HAR. Screenshots only
    // show pages (every sign-in goes through RPC, so no password field is ever filled in a browser).
    trace: "off",
    video: "off",
    screenshot: "on",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
});
