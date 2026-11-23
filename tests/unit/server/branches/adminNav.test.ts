import { describe, expect, it } from "vitest";
import { navFor } from "@/components/shared/adminNav";

const labels = (role: Parameters<typeof navFor>[0]) => navFor(role).map((i) => i.label);

describe("admin navigation by role (US-23, US-25)", () => {
  it("main admins see Branches and not Advisors", () => {
    expect(labels("main_admin")).toContain("Branches");
    expect(labels("main_admin")).not.toContain("Advisors");
  });

  it("branch admins see Advisors and not Branches", () => {
    expect(labels("branch_admin")).toContain("Advisors");
    expect(labels("branch_admin")).not.toContain("Branches");
  });
});
