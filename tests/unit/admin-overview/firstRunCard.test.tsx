import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ok, type DataAccess } from "@/data/access";
import { DataAccessProvider } from "@/data/access/provider";
import { FirstRunCard } from "@/features/admin-overview/FirstRunCard";

afterEach(cleanup);

function renderCard(role: string, branches: unknown[]) {
  const da = {
    auth: { currentUser: () => Promise.resolve(ok({ id: "u1", role })) },
    branches: { listBranches: () => Promise.resolve(ok(branches)) },
  } as unknown as DataAccess;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DataAccessProvider value={da}>
        <FirstRunCard />
      </DataAccessProvider>
    </QueryClientProvider>,
  );
}

describe("FirstRunCard", () => {
  it("main admin, no branches → Add your first branch link to /admin/branches", async () => {
    renderCard("main_admin", []);
    const link = await screen.findByRole("link", { name: "Add your first branch" });
    expect(link.getAttribute("href")).toBe("/admin/branches");
  });
  it("main admin, a branch exists → nothing rendered", async () => {
    const { container } = renderCard("main_admin", [{ id: "b1" }]);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.innerHTML).toBe("");
  });
  it("branch admin, no branches → nothing rendered", async () => {
    const { container } = renderCard("branch_admin", []);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.innerHTML).toBe("");
  });
});
