/** Upper-case, spaces and dashes removed: `jc-24-1042`, ` JC241042` and `JC 24 1042` all become `JC241042`. */
export function normalizeJobCardNo(s: string): string {
  return s.replace(/[\s-]+/g, "").toUpperCase();
}
