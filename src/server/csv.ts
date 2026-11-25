const BOM = "﻿";
const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/;

type Cell = string | number | null | undefined;

/** One CSV cell: formula starters get a leading `'`, then RFC 4180 quoting. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 document (CRLF lines) with a UTF-8 BOM so Excel reads it as UTF-8. */
export function toCsv(rows: Cell[][]): string {
  return BOM + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
