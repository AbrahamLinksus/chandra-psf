import { describe, expect, it } from "vitest";
import { SESSION_KEY } from "@/hooks/useSession";

describe("SESSION_KEY", () => {
  it("is the shared session query key", () => {
    expect(SESSION_KEY).toEqual(["session"]);
  });
});
