import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Reveal } from "@/features/feedback-form/Reveal";

function Harness({ open, parent }: { open: boolean; parent: boolean }) {
  return (
    <div>
      <button data-testid="trigger">parent</button>
      <Reveal
        open={open}
        value={1}
        returnFocusTo={() => (parent ? screen.getByTestId("trigger") : null)}
      >
        {() => <input data-testid="inner" />}
      </Reveal>
    </div>
  );
}

function mockMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Reveal", () => {
  it("moves focus to the trigger when it collapses with focus inside", () => {
    mockMotion(false);
    const { rerender } = render(<Harness open parent />);
    act(() => {
      screen.getByTestId("inner").focus();
    });
    rerender(<Harness open={false} parent />);
    expect(document.activeElement).toBe(screen.getByTestId("trigger"));
  });

  it("leaves focus alone when it was outside the collapsing content", () => {
    mockMotion(false);
    const { rerender } = render(<Harness open parent />);
    const other = document.createElement("button");
    document.body.append(other);
    other.focus();
    rerender(<Harness open={false} parent />);
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("keeps content mounted for the close animation under normal motion", () => {
    mockMotion(false);
    vi.useFakeTimers();
    const { rerender } = render(<Harness open parent={false} />);
    rerender(<Harness open={false} parent={false} />);
    expect(screen.queryByTestId("inner")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId("inner")).toBeNull();
  });

  it("unmounts immediately under prefers-reduced-motion", () => {
    mockMotion(true);
    const { rerender } = render(<Harness open parent={false} />);
    rerender(<Harness open={false} parent={false} />);
    expect(screen.queryByTestId("inner")).toBeNull();
  });
});
