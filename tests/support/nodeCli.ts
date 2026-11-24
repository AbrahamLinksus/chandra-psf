import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

/**
 * JS entry points of the CLIs tests spawn. Run them as `execFileSync(process.execPath, [CLI, ...])`:
 * the `pnpm` and `node_modules/.bin` names are `.cmd` shims on Windows, which execFileSync cannot start.
 */
export const TSX_CLI = join(ROOT, "node_modules/tsx/dist/cli.mjs");
export const DEPCRUISE_CLI = join(
  ROOT,
  "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
);
