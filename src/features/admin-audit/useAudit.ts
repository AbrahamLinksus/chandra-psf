"use client";

import { useState } from "react";
import type { AuditAction } from "@/domain/types";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { useSession } from "@/hooks/useSession";
import { useAuditPages, type AuditQuery } from "./useAuditPages";

export type AuditFilter = AuditAction | "all";

function buildFilter(action: AuditFilter, branchId: string | undefined): AuditQuery {
  return {
    ...(action === "all" ? {} : { action }),
    ...(branchId === undefined ? {} : { branchId }),
  };
}

/** Audit entries (newest first, paged by cursor) narrowed by action and, for the main admin, branch. */
export function useAudit() {
  const { user } = useSession();
  const isMain = user?.role === "main_admin";
  const [action, setAction] = useState<AuditFilter>("all");
  const [branchId, setBranchId] = useState("all");
  const branches = useRepoQuery(["branches", isMain ? "list" : "none"], (d) =>
    isMain ? d.branches.listBranches() : Promise.resolve({ ok: true as const, value: [] }),
  );
  const scoped = isMain && branchId !== "all" ? branchId : undefined;
  const filter = buildFilter(action, scoped);
  const query = useRepoQuery(["audit", "list", action, scoped ?? "all"], (d) =>
    d.audit.listAudit(filter),
  );
  const pages = useAuditPages(`${action}|${scoped ?? "all"}`, filter, query.data);
  return {
    ...pages,
    action,
    setAction,
    isMain,
    branchId,
    setBranchId,
    branchOptions: branches.data?.map((b) => ({ value: b.id, label: b.name })) ?? [],
    error: query.error,
    isLoading: query.isLoading,
  };
}
