"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useOpenAlertCount } from "@/hooks/useOpenAlertCount";
import { useShellActions } from "@/hooks/useShellActions";
import { AdminActions } from "./AdminActions";
import { AdminMoreSheet, AdminSidebar, AdminTabBar } from "./AdminNavParts";
import { activeNavHref } from "./adminNav";
import { DemoLabel } from "./DemoLabel";
import { ResetDemoDialog } from "./ResetDemoDialog";

/** Sidebar from md up, bottom tab bar (Overview, Alerts, Responses, More) below. */
export function AdminShell({ children }: { children: ReactNode }) {
  const active = activeNavHref(usePathname());
  const count = useOpenAlertCount();
  const { signOut, simulateFailedSave } = useShellActions();
  const [moreOpen, setMoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const closeMoreThen = (fn: () => void) => () => {
    setMoreOpen(false);
    fn();
  };
  const actions = (
    <AdminActions
      onSimulateFailure={closeMoreThen(() => void simulateFailedSave())}
      onReset={closeMoreThen(() => {
        setResetOpen(true);
      })}
      onSignOut={closeMoreThen(() => void signOut())}
    />
  );

  return (
    <div className="min-h-screen bg-secondary/40 md:flex">
      <AdminSidebar active={active} count={count} actions={actions} />
      <div className="min-w-0 flex-1 pb-16 md:pb-0">
        <div className="flex items-center justify-between border-b bg-card px-4 py-2 md:hidden">
          <span className="font-semibold">Chandra Honda PSF</span>
          <DemoLabel />
        </div>
        {children}
      </div>
      <AdminTabBar
        active={active}
        count={count}
        onMore={() => {
          setMoreOpen(true);
        }}
      />
      <AdminMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        active={active}
        count={count}
        actions={actions}
      />
      <ResetDemoDialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
        }}
      />
    </div>
  );
}
