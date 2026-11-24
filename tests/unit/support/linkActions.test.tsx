import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VisitSummary } from "@/data/access";
import { LinkActions } from "@/features/support/LinkActions";
import type { LinkActionsState } from "@/features/support/useLinkActions";

function state(over: Partial<VisitSummary>, extra: Partial<LinkActionsState> = {}) {
  const visit = { id: "v", mine: true, phone: "+919840012345", status: "created", ...over };
  return {
    visit,
    issued: null,
    copied: null,
    status: "idle",
    error: undefined,
    copy: vi.fn(),
    resend: vi.fn(),
    regenerate: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    ...extra,
  } as unknown as LinkActionsState;
}

afterEach(cleanup);

describe("LinkActions", () => {
  it("a completed link says 'Feedback already received' and offers nothing else", () => {
    render(<LinkActions a={state({ status: "completed" })} />);
    expect(screen.queryByText("Feedback already received")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a current link reopened offers Resend and Regenerate, not Copy or Send", () => {
    render(<LinkActions a={state({})} />);
    expect(screen.getByRole("button", { name: /Resend/ })).toHaveProperty("disabled", false);
    expect(screen.queryByRole("button", { name: /Regenerate/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Copy link/ })).toBeNull();
  });

  it("a link made by a colleague can still be resent, regenerated and cancelled", () => {
    render(<LinkActions a={state({ mine: false })} />);
    expect(screen.queryByRole("button", { name: /Resend/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Regenerate/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Cancel/ })).not.toBeNull();
  });
});
