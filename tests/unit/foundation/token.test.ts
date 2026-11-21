import { describe, expect, it } from "vitest";
import { decodeToken, encodeToken } from "@/data/local/repos/token";

const visit = {
  id: "v-1",
  jobCardNo: "JC-24-1042",
  createdAt: "2026-03-10T06:30:00.000Z",
  expiresAt: "2026-03-17T06:30:00.000Z",
  phone: "+91 98400 12345",
};

describe("token", () => {
  it("encode → decode round-trips the payload", () => {
    expect(decodeToken(encodeToken(visit))).toEqual({
      visitId: "v-1",
      jobCardNo: "JC-24-1042",
      createdAt: visit.createdAt,
      expiresAt: visit.expiresAt,
      phone: visit.phone,
    });
  });

  it("round-trips a null phone and non-ASCII text", () => {
    const t = encodeToken({ ...visit, id: "v-é✓", phone: null });
    expect(decodeToken(t)).toMatchObject({ visitId: "v-é✓", phone: null });
  });

  it("is body + '.' + 8 url-safe chars", () => {
    expect(encodeToken(visit)).toMatch(/^[A-Za-z0-9_-]+\.[a-z0-9]{8}$/);
  });

  it.each(["", "garbage", "abc.def", "a.b.c", "!!!.abcdefgh", "e30.abcdefgh"])(
    "decode(%j) → null",
    (bad) => {
      expect(decodeToken(bad)).toBeNull();
    },
  );
});
