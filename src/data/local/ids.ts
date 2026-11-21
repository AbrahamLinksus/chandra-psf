/** Short unique id with a readable prefix, e.g. `v-3f2a9c1b`. */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
