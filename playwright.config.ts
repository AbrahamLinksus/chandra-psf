import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Fresh clones have no env file; fall back to the public demo values in the example file.
function exampleEnv(): Record<string, string> {
  if (existsSync(".env") || existsSync(".env.local") || !existsSync(".env.example")) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(".env.example", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

const port = process.env["PORT"] ?? "8000";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } } },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    env: { ...exampleEnv(), ...(process.env as Record<string, string>) },
    timeout: 60_000,
  },
});
