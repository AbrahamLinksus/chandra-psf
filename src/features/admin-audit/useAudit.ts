"use client";

import { useState } from "react";
import type { AuditAction } from "@/domain/types";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export type AuditFilter = AuditAction | "all";

/** Audit entries (newest first) narrowed by an optional action. */
export function useAudit() {
  const [action, setAction] = useState<AuditFilter>("all");
  const query = useRepoQuery(["audit", "list", action], (da) =>
    da.audit.listAudit(action === "all" ? undefined : { action }),
  );
  return { action, setAction, rows: query.data, error: query.error, isLoading: query.isLoading };
}
