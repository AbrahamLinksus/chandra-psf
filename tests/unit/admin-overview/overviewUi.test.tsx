/* eslint-disable max-lines-per-function -- describe blocks group many one-line tests */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { err, type DataAccess } from "@/data/access";
import { DataAccessProvider } from "@/data/access/provider";
import { AdminOverviewScreen } from "@/features/admin-overview/AdminOverviewScreen";
import { sortAdvisors, type AdvisorRow } from "@/features/admin-overview/advisorSort";
import { DeltaArrow } from "@/features/admin-overview/KpiTiles";
import { RecentComments } from "@/features/admin-overview/RecentComments";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(""),
}));
afterEach(cleanup);

const row = (name: string, avgQ12: number | null): AdvisorRow => ({
  advisorId: name,
  name,
  responses: 1,
  avgQ6: null,
  q4Yes: null,
  q7Yes: null,
  avgQ12,
});

describe("sortAdvisors", () => {
  it("descending → highest first, empty values last", () => {
    const out = sortAdvisors([row("a", null), row("b", 2), row("c", 4)], "avgQ12", "desc");
    expect(out.map((r) => r.name)).toEqual(["c", "b", "a"]);
  });
  it("ascending → lowest first, empty values still last", () => {
    const out = sortAdvisors([row("a", null), row("b", 4), row("c", 2)], "avgQ12", "asc");
    expect(out.map((r) => r.name)).toEqual(["c", "b", "a"]);
  });
  it("by name ascending → alphabetical", () => {
    const out = sortAdvisors([row("b", 1), row("a", 1)], "name", "asc");
    expect(out.map((r) => r.name)).toEqual(["a", "b"]);
  });
});

describe("DeltaArrow", () => {
  it("positive delta → green up arrow", () => {
    render(<DeltaArrow delta={5} format="percent" />);
    expect(screen.getByTestId("delta").className).toContain("text-success");
  });
  it("negative delta → red down arrow", () => {
    render(<DeltaArrow delta={-0.4} format="score" />);
    expect(screen.getByTestId("delta").className).toContain("text-danger");
  });
  it("null delta → nothing rendered (S-10)", () => {
    const { container } = render(<DeltaArrow delta={null} format="score" />);
    expect(container.innerHTML).toBe("");
  });
  it("zero delta → no change, no arrow", () => {
    render(<DeltaArrow delta={0} format="count" />);
    expect(screen.queryByTestId("delta")).toBeNull();
    expect(screen.getByText(/no change/)).toBeTruthy();
  });
});

describe("RecentComments", () => {
  it("comment containing <script> → shown as plain text (G-W3)", () => {
    const text = "<script>alert(1)</script>";
    const { container } = render(
      <RecentComments
        comments={[{ responseId: "r1", serviceDate: "2026-11-01", source: "Q14", text, q12: 4 }]}
      />,
    );
    expect(screen.getByText(text)).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
  });
  it("no comments → a dash", () => {
    render(<RecentComments comments={[]} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});

describe("AdminOverviewScreen", () => {
  it("support session (FORBIDDEN) → Not allowed, no blocks (G-W2)", async () => {
    const forbidden = () => Promise.resolve(err("FORBIDDEN", "Not allowed"));
    const da = {
      analytics: { getAnalytics: forbidden, getFilterOptions: forbidden },
    } as unknown as DataAccess;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DataAccessProvider value={da}>
          <AdminOverviewScreen />
        </DataAccessProvider>
      </QueryClientProvider>,
    );
    expect((await screen.findByRole("alert")).textContent).toBe("Not allowed");
    expect(screen.queryByText("Category scores")).toBeNull();
  });
});
