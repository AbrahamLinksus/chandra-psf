import type { ISOTime, Visit } from "@/domain/types";

export interface TokenPayload {
  visitId: string;
  jobCardNo: string;
  createdAt: ISOTime;
  expiresAt: ISOTime;
  phone: string | null;
}

const SUFFIX_LENGTH = 8;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(part: string): string {
  const padded = part
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(part.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH));
  return Array.from(bytes, (b) => ALPHABET.charAt(b % ALPHABET.length)).join("");
}

type TokenSource = Pick<Visit, "id" | "jobCardNo" | "createdAt" | "expiresAt" | "phone">;

/** Phase 1 only: base64url(JSON payload) + "." + 8 random chars (LLD 9 Token). */
export function encodeToken(visit: TokenSource): string {
  const payload = { v: visit.id, j: visit.jobCardNo, c: visit.createdAt, e: visit.expiresAt, p: visit.phone };
  return `${toBase64Url(JSON.stringify(payload))}.${randomSuffix()}`;
}

interface RawPayload {
  v: string;
  j: string;
  c: string;
  e: string;
  p: string | null;
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isIsoTime(x: unknown): boolean {
  return typeof x === "string" && ISO_8601.test(x) && !Number.isNaN(Date.parse(x));
}

function isPayload(x: unknown): x is RawPayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const strings = [o["v"], o["j"]].every((s) => typeof s === "string");
  return strings && isIsoTime(o["c"]) && isIsoTime(o["e"]) && (o["p"] === null || typeof o["p"] === "string");
}

/** Returns null for anything that is not a token produced by `encodeToken`. */
export function decodeToken(token: string): TokenPayload | null {
  const [body, suffix, ...rest] = token.split(".");
  if (body === undefined || suffix?.length !== SUFFIX_LENGTH || rest.length > 0) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(body));
    if (!isPayload(parsed)) return null;
    return { visitId: parsed.v, jobCardNo: parsed.j, createdAt: parsed.c, expiresAt: parsed.e, phone: parsed.p };
  } catch {
    return null;
  }
}
