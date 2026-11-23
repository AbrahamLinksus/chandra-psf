import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const noCoverage = process.env["CHECK_NO_COVERAGE"] === "1";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    // PGlite boot + migrations and source-tree scans exceed the 5 s default under parallel coverage load.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/data/**", "src/hooks/**", "src/server/**"],
      exclude: [
        "src/data/seed/seed.json",
        "**/*.d.ts",
        // Pure drizzle table/enum declarations; bytea.ts holds real conversion logic and stays in.
        "src/server/db/schema/!(bytea).ts",
      ],
      ...(noCoverage
        ? {}
        : { thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } }),
    },
  },
});
