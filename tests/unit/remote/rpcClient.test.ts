import { describe, expect, it, vi } from "vitest";
import { createRemoteDataAccess } from "@/data/remote/createRemoteDataAccess";
import { kindOf, rpc } from "@/data/remote/rpcClient";

function deps(fetchImpl: typeof fetch, active = true) {
  return { fetch: fetchImpl, isActive: () => active, onUnauthenticated: vi.fn() };
}
const json = (body: unknown): Response => new Response(JSON.stringify(body));
const headersOf = (f: ReturnType<typeof vi.fn>): Record<string, string> =>
  (f.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;

describe("rpc client", () => {
  it("POSTs JSON to /api/rpc/<repo>/<method> with x-psf-active", async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, value: 1 }));
    expect(await rpc(deps(f), "jobCards", "getJobCard", ["a"])).toEqual({ ok: true, value: 1 });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/rpc/jobCards/getJobCard");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ args: ["a"] }));
    expect(headersOf(f)["x-psf-active"]).toBe("1");
    expect(headersOf(f)["content-type"]).toBe("application/json");
  });

  it("sends x-psf-active 0 when the tab is not active", async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, value: 1 }));
    await rpc(deps(f, false), "auth", "currentUser", []);
    expect(headersOf(f)["x-psf-active"]).toBe("0");
  });

  it("maps a network failure on a write to SAVE_FAILED and on a read to UNAVAILABLE", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("offline"));
    expect(await rpc(deps(f), "visits", "createVisitLink", [])).toMatchObject({
      ok: false,
      error: { code: "SAVE_FAILED" },
    });
    expect(await rpc(deps(f), "visits", "listMyVisits", [])).toMatchObject({
      ok: false,
      error: { code: "UNAVAILABLE" },
    });
  });
});

describe("rpc client replies", () => {
  it("treats a non-Result or non-JSON reply as a network failure by kind", async () => {
    const bad = vi.fn().mockResolvedValue(json({ nope: 1 }));
    expect(await rpc(deps(bad), "responses", "deleteResponse", [])).toMatchObject({
      error: { code: "SAVE_FAILED" },
    });
    const html = vi.fn().mockResolvedValue(new Response("<html>"));
    expect(await rpc(deps(html), "responses", "getResponse", [])).toMatchObject({
      error: { code: "UNAVAILABLE" },
    });
    const nul = vi.fn().mockResolvedValue(json(null));
    expect(await rpc(deps(nul), "responses", "getResponse", [])).toMatchObject({ ok: false });
  });

  it("calls onUnauthenticated once for UNAUTHENTICATED, and not for other errors", async () => {
    const d = deps(
      vi
        .fn()
        .mockResolvedValue(json({ ok: false, error: { code: "UNAUTHENTICATED", message: "x" } })),
    );
    expect(await rpc(d, "auth", "currentUser", [])).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(d.onUnauthenticated).toHaveBeenCalledTimes(1);
    const d2 = deps(
      vi.fn().mockResolvedValue(json({ ok: false, error: { code: "VALIDATION", message: "x" } })),
    );
    await rpc(d2, "auth", "currentUser", []);
    expect(d2.onUnauthenticated).not.toHaveBeenCalled();
  });

  it("classifies method kinds by prefix", () => {
    for (const m of ["getX", "listX", "countX", "currentUser"]) expect(kindOf(m)).toBe("read");
    for (const m of ["signIn", "editResponse", "cancelLink"]) expect(kindOf(m)).toBe("write");
  });
});

describe("createRemoteDataAccess", () => {
  it("turns repo method calls into RPC posts, using the activity source", async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true, value: [] }));
    const listener = vi.fn();
    const subscribe = vi.fn().mockReturnValue(() => undefined);
    const access = createRemoteDataAccess({
      fetch: f,
      activity: { isActive: () => false },
      onUnauthenticated: vi.fn(),
      poller: { subscribe },
    });
    await access.alerts.listAlerts({});
    expect((f.mock.calls[0] as [string])[0]).toBe("/api/rpc/alerts/listAlerts");
    expect(headersOf(f)["x-psf-active"]).toBe("0");
    access.subscribe(listener);
    expect(subscribe).toHaveBeenCalledWith(listener);
    expect((access.auth as unknown as { then?: unknown }).then).toBeUndefined();
  });
});
