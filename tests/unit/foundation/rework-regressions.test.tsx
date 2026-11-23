import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordPromptDialog } from "@/components/shared/PasswordPromptDialog";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";
import { reconcileAlert } from "@/domain/alertRules";
import type { Alert } from "@/domain/types";
import { useFiltersFromUrl } from "@/hooks/useFiltersFromUrl";

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin/responses",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

afterEach(cleanup);

describe("reconcileAlert (rework 3)", () => {
  const now = new Date("2026-03-10T06:30:00.000Z");
  it("throws RangeError when creating without ids", () => {
    expect(() => reconcileAlert(null, [{ kind: "callback" }], now)).toThrow(RangeError);
  });
  it("existing already-resolved alert whose reasons vanish returns {existing, none}", () => {
    const resolved: Alert = {
      id: "al-1",
      responseId: "r-1",
      reasons: [{ kind: "callback" }],
      status: "resolved",
      notes: [],
      createdAt: "2026-03-09T06:30:00.000Z",
      updatedAt: "2026-03-09T06:30:00.000Z",
    };
    const r = reconcileAlert(resolved, [], now);
    expect(r).toEqual({ alert: resolved, change: "none" });
    expect(r.alert).toBe(resolved);
  });
});

describe("useFiltersFromUrl malformed dates (rework)", () => {
  it("falls back to the default range when from/to are malformed", () => {
    nav.search = "from=garbage&to=2026-13";
    const { result } = renderHook(() => useFiltersFromUrl());
    const { from, to } = result.current.filters;
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).not.toBe("2026-13");
    expect(Date.parse(to) - Date.parse(from)).toBe(30 * 86_400_000);
    nav.search = "";
  });
});

describe("PlaceholderScreen", () => {
  it("shows its title and no demo label", () => {
    render(<PlaceholderScreen title="Alerts" />);
    expect(screen.getByText("Alerts")).toBeTruthy();
    expect(screen.queryByText(/Demo/)).toBeNull();
  });
});

describe("PasswordPromptDialog busy reset", () => {
  it("re-enables the button when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    // The rejection surfaces as an unhandled rejection from the submit handler; swallow it here.
    const swallow = vi.fn();
    process.on("unhandledRejection", swallow);
    render(<PasswordPromptDialog open title="Confirm" onConfirm={onConfirm} onClose={vi.fn()} />);
    const button = screen.getByRole("button", { name: /confirm|delete|save|submit|continue/i });
    fireEvent.change(document.querySelector("input") as HTMLInputElement, {
      target: { value: "pw" },
    });
    fireEvent.click(button);
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("pw");
    });
    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
    process.off("unhandledRejection", swallow);
  });
});
