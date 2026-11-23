import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminActions } from "@/components/shared/AdminActions";
import { SignInScreen } from "@/features/auth/SignInScreen";
import { NewLinkScreen } from "@/features/support/NewLinkScreen";
import { err, ok } from "@/data/access";
import { dataWrapper, fakeDataAccess } from "../../support/fakeDataAccess";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/sign-in",
  useSearchParams: () => new URLSearchParams(""),
}));
afterEach(cleanup);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("sign-in screen is email + password only (SPEC 0.1)", () => {
  it("shows the two fields, the forgot-password note and no picker, demo label or reset-demo control", () => {
    render(<SignInScreen />, { wrapper: dataWrapper() });
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/Demo/i)).toBeNull();
    expect(screen.getByText("Forgot your password? Ask your admin to reset it.")).toBeTruthy();
    expect(screen.queryByText(/Reset demo/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Reset/i })).toBeNull();
  });

  it("a wrong password shows the server's message and stays on the screen", async () => {
    const signIn = vi.fn(() => Promise.resolve(err("BAD_CREDENTIALS", "Wrong email or password")));
    render(<SignInScreen />, { wrapper: dataWrapper(fakeDataAccess({ auth: { signIn } })) });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Wrong email or password");
    });
    expect(signIn).toHaveBeenCalledWith("a@b.co", "wrongpass");
  });
});

describe("admin More has no Simulate failed save", () => {
  it("offers Sign out only", () => {
    render(<AdminActions onSignOut={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeTruthy();
    expect(screen.queryByText(/Simulate/i)).toBeNull();
  });
});

describe("/support/new has no fresh job card hint", () => {
  it("looking up a card shows its details and never lists fresh cards", async () => {
    const jobCard = {
      id: "j1",
      jobCardNo: "JC-1",
      customerName: "Ramesh Kumar",
      regNo: "TN01AB1234",
      model: "Activa",
      vehicleType: "scooter",
      serviceType: "Paid",
      serviceDate: "2026-03-10",
      advisorName: "Ravi",
    };
    const jobCards = {
      getJobCard: vi.fn(() => Promise.resolve(ok({ jobCard, current: null }))),
      listFreshJobCards: vi.fn(() => Promise.resolve(ok(["JC-24-1042"]))),
    };
    const da = fakeDataAccess({ jobCards } as never);
    render(<NewLinkScreen />, { wrapper: dataWrapper(da) });
    expect(screen.queryByText(/fresh|try one of|available job cards/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Job card number"), { target: { value: "JC-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));
    await waitFor(() => {
      expect(screen.getByText("Ramesh Kumar")).toBeTruthy();
    });
    expect(screen.queryByText(/JC-24-1042/)).toBeNull();
    expect(jobCards.listFreshJobCards).not.toHaveBeenCalled();
  });
});

describe("demo code is gone from the source tree", () => {
  it("has no src/data/local, seed files or local-store imports", () => {
    expect(existsSync(join("src", "data", "local"))).toBe(false);
    expect(existsSync(join("src", "data", "seed"))).toBe(false);
    const offenders = files("src").filter((f) =>
      /data\/local|data\/seed|DEMO_PASSWORD|NEXT_PUBLIC_APP_URL/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("exceljs is not in package.json and check.sh has no seed step", () => {
    expect(readFileSync("package.json", "utf8")).not.toMatch(/exceljs/i);
    expect(readFileSync(join("scripts", "check.sh"), "utf8")).not.toMatch(/seed/i);
  });

  it("only providers.tsx imports @/data/remote", () => {
    const importers = files("src").filter((f) =>
      /from "@\/data\/remote/.test(readFileSync(f, "utf8")),
    );
    expect(importers).toEqual([join("src", "app", "providers.tsx")]);
  });
});
