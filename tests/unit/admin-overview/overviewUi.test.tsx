import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { err, type DataAccess } from "@/data/access";
import { DataAccessProvider } from "@/data/access/provider";
import { AdminOverviewScreen } from "@/features/admin-overview/AdminOverviewScreen";
import { sortAdvisors, type AdvisorRow } from "@/features/admin-overview/advisorSort";
import { DeltaArrow } from "@/features/admin-overview/KpiTiles";
import { AdvisorTable } from "@/features/admin-overview/AdvisorTable";
import { CategoryScores } from "@/features/admin-overview/CategoryScores";
import { KpiTiles } from "@/features/admin-overview/KpiTiles";
import { computeOverview } from "@/domain/metrics/overview";
import type { AnswerMap } from "@/domain/types";
import { build, F } from "./overviewFixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(""),
}));
afterEach(cleanup);

const row = (name: string, score: number | null): AdvisorRow => ({
  advisorId: name,
  name,
  branchName: null,
  responses: 3,
  score,
  avgBehaviour: null,
  onTimePercent: null,
  avgSatisfaction: null,
});

describe("sortAdvisors", () => {
  it("descending → highest first, empty values last", () => {
    const out = sortAdvisors([row("a", null), row("b", 2), row("c", 4)], "score", "desc");
    expect(out.map((r) => r.name)).toEqual(["c", "b", "a"]);
  });
  it("ascending → lowest first, empty values still last", () => {
    const out = sortAdvisors([row("a", null), row("b", 4), row("c", 2)], "score", "asc");
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

const ANSWERS: AnswerMap[] = [
  { Q1: 4, Q2: "Yes", Q3: "No", Q4: 5, Q9: "Yes", Q10: "Yes" },
  { Q1: 2, Q1a: { options: ["Poor workmanship"] }, Q2: "No", Q3: "Yes", Q4: 3, Q9: "No" },
  { Q1: 3, Q2: "Partially", Q3: "No", Q4: 4, Q9: "Yes", Q10: "No" },
];
const data = computeOverview(
  build(
    ANSWERS.map((a, i) => ({
      answers: a,
      card: { advisorId: i ? "a1" : "a2" },
    })),
  ),
  F,
  { a1: "Suresh", a2: "Bala" },
);

describe("KpiTiles", () => {
  it("shows the three v2 tiles by label", () => {
    render(<KpiTiles kpis={data.kpis} />);
    for (const label of ["Avg overall satisfaction", "Recommend rate", "Callbacks requested"]) {
      expect(document.querySelector(`[data-label="${label}"]`)).not.toBeNull();
    }
    expect(
      document.querySelector('[data-label="Avg overall satisfaction"]')?.textContent,
    ).toContain("3.0");
    expect(document.querySelector('[data-label="Callbacks requested"]')?.textContent).toContain(
      "1",
    );
  });
});

describe("CategoryScores", () => {
  it("rows start collapsed; opening one shows its questions, bars and merged follow-up, in words", () => {
    render(<CategoryScores scores={data.categoryScores} />);
    expect(screen.getAllByTestId("category-row")).toHaveLength(5);
    expect(screen.queryAllByTestId("category-question")).toHaveLength(0);
    const first = screen.getAllByTestId("category-row")[0] as HTMLElement;
    fireEvent.click(within(first).getByRole("button"));
    expect(within(first).getAllByTestId("category-question")).toHaveLength(3);
    expect(within(first).getAllByTestId("follow-up")[0]?.textContent).toContain("Poor workmanship");
    expect(first.textContent).toContain("Rating 4");
    expect(first.textContent).toContain("Partially");
    expect(within(first).getAllByTestId("category-score")[0]?.textContent).toContain("/ 100");
  });
  it("no Problem breakdown, Question detail or Recent comments blocks", () => {
    render(<CategoryScores scores={data.categoryScores} />);
    expect(screen.queryByText(/Problem breakdown|Question detail|Recent comments/)).toBeNull();
  });
});

describe("AdvisorTable", () => {
  it("shows score /100, a dash for an advisor under 3 responses, and re-sorts by name", () => {
    const rows = [
      { ...row("Zed", 80), name: "Zed" },
      { ...row("Amy", null), name: "Amy" },
    ];
    render(<AdvisorTable advisors={rows} showBranch={false} />);
    const scores = screen.getAllByTestId("advisor-score").map((e) => e.textContent);
    expect(scores).toEqual(["80 /100", "—", "80 /100", "—"].slice(0, scores.length));
    expect(screen.getAllByTestId("advisor-row")[0]?.textContent).toContain("Zed");
    fireEvent.click(screen.getAllByRole("button", { name: "Advisor" })[0] as HTMLElement);
    fireEvent.click(screen.getAllByRole("button", { name: "Advisor" })[0] as HTMLElement);
    expect(screen.getAllByTestId("advisor-row")[0]?.textContent).toContain("Amy");
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
