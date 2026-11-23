"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useOpenAlertCount } from "@/hooks/useOpenAlertCount";
import { useSession } from "@/hooks/useSession";
import { useShellActions } from "@/hooks/useShellActions";
import { AdminActions } from "./AdminActions";
import { AdminMoreSheet, AdminSidebar, AdminTabBar } from "./AdminNavParts";
import { activeNavHref, navFor } from "./adminNav";

/** Sidebar from md up, bottom tab bar (Overview, Alerts, Responses, More) below. */
export function AdminShell({ children }: { children: ReactNode }) {
  const nav = navFor(useSession().user?.role);
  const active = activeNavHref(usePathname(), nav);
  const count = useOpenAlertCount();
  const { signOut } = useShellActions();
  const [moreOpen, setMoreOpen] = useState(false);
  const actions = (
    <AdminActions
      onSignOut={() => {
        setMoreOpen(false);
        void signOut();
      }}
    />
  );

  return (
    <div className="min-h-screen bg-secondary/40 md:flex">
      <AdminSidebar nav={nav} active={active} count={count} actions={actions} />
      <div className="min-w-0 flex-1 pb-16 md:pb-0">
        <div className="flex items-center justify-between border-b bg-card px-4 py-2 md:hidden">
          <span className="font-semibold">Chandra Honda PSF</span>
        </div>
        {children}
      </div>
      <AdminTabBar
        nav={nav}
        active={active}
        count={count}
        onMore={() => {
          setMoreOpen(true);
        }}
      />
      <AdminMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        nav={nav}
        active={active}
        count={count}
        actions={actions}
      />
    </div>
  );
}
