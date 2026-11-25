"use client";

import { useState } from "react";
import type { AuditEntryView, AuditPage } from "@/data/access/repos/audit";
import { useDataAccess } from "@/data/access/provider";

export interface AuditQuery {
  action?: string;
  branchId?: string;
}

interface More {
  key: string;
  entries: AuditEntryView[];
  cursor: string | null;
}

/** Pages after the first one, appended by cursor; reset whenever the filter key changes. */
export function useAuditPages(key: string, filter: AuditQuery, first: AuditPage | undefined) {
  const da = useDataAccess();
  const [more, setMore] = useState<More | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const extra = more?.key === key ? more : null;
  const cursor = extra ? extra.cursor : (first?.nextCursor ?? null);

  const loadMore = async () => {
    if (cursor === null) return;
    setLoading(true);
    setError(undefined);
    const res = await da.audit.listAudit({ ...filter, before: cursor });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const entries = [...(extra?.entries ?? []), ...res.value.entries];
    setMore({ key, entries, cursor: res.value.nextCursor });
  };

  return {
    rows: first ? [...first.entries, ...(extra?.entries ?? [])] : undefined,
    hasMore: cursor !== null,
    loadMore,
    loadingMore: loading,
    moreError: error,
  };
}
