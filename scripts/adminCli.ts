// Option parsing for the maintainer CLI (scripts/admin.ts).
import { parseArgs } from "node:util";

export function parseCli(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      name: { type: "string" },
      email: { type: "string" },
      from: { type: "string" },
      since: { type: "string" },
      "no-admin-can-sign-in": { type: "boolean", default: false },
      "confirm-delete-all-feedback": { type: "boolean", default: false },
      "database-host": { type: "string" },
    },
  });
}
