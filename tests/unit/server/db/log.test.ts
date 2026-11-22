// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createLogger, LogFieldError } from "@/server/log";

function make() {
  const lines: string[] = [];
  const logger = createLogger(
    (l) => {
      lines.push(l);
    },
    () => new Date("2026-11-22T00:00:00Z"),
  );
  return { lines, logger };
}

describe("log", () => {
  it("writes a JSON line with ids and counts", () => {
    const { lines, logger } = make();
    logger.event("visit_created", { visitId: "v1", count: 3 });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      at: "2026-11-22T00:00:00.000Z",
      level: "info",
      event: "visit_created",
      visitId: "v1",
      count: 3,
    });
  });

  it.each(["customerName", "phone", "email"])("refuses a %s field", (key) => {
    const { lines, logger } = make();
    expect(() => {
      logger.event("x", { [key]: "v" });
    }).toThrow(LogFieldError);
    expect(lines).toHaveLength(0);
  });

  it("refuses a long string value", () => {
    const { logger } = make();
    expect(() => {
      logger.event("x", { id: "a".repeat(65) });
    }).toThrow(LogFieldError);
  });

  it("logs an error with its class only", () => {
    const { lines, logger } = make();
    logger.error("repo.save", "TypeError");
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ level: "error", errorClass: "TypeError" });
  });
});

describe("log validation", () => {
  it.each(["level", "event", "where", "at", "errorClass"])(
    "refuses the reserved field %s",
    (key) => {
      const { lines, logger } = make();
      expect(() => {
        logger.event("x", { [key]: "v" });
      }).toThrow(/reserved key/);
      expect(lines).toHaveLength(0);
    },
  );

  it("refuses an event name that is not a short identifier", () => {
    const { lines, logger } = make();
    expect(() => {
      logger.event("a b");
    }).toThrow(LogFieldError);
    expect(lines).toHaveLength(0);
  });

  it("refuses an errorClass that looks like an email, and a bad where", () => {
    const { lines, logger } = make();
    expect(() => {
      logger.error("x", "a@b.com");
    }).toThrow(LogFieldError);
    expect(() => {
      logger.error("bad where", "TypeError");
    }).toThrow(LogFieldError);
    expect(lines).toHaveLength(0);
  });

  it("writes to stdout by default", async () => {
    const { log } = await import("@/server/log");
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    log.event("ping", { count: 1 });
    expect(String(spy.mock.calls[0]?.[0])).toContain('"event":"ping"');
    spy.mockRestore();
  });
});
