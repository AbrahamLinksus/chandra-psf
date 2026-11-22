"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DataAccess, Result, VisitSummary } from "@/data/access";
import { useSession } from "@/hooks/useSession";
import { useRepoMutation, type MutationStatus } from "@/hooks/useRepoMutation";
import type { RepoError } from "@/data/access";

const COPIED_MS = 2000;

const regenerateFn = (da: DataAccess, id: string): Promise<Result<VisitSummary>> =>
  da.visits.regenerateLink(id);
const cancelFn = (da: DataAccess, id: string): Promise<Result<VisitSummary>> =>
  da.visits.cancelLink(id);

export interface LinkActionsState {
  /** Button label after a copy attempt, or null before one. */
  copied: string | null;
  canManage: boolean;
  status: MutationStatus;
  error: RepoError | undefined;
  copy: () => void;
  regenerate: () => Promise<void>;
  cancel: () => Promise<boolean>;
  reset: () => void;
}

/** Copies `text`; `copied` is the label to flash (Copied or Couldn't copy). */
function useCopy(text: string) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(() => {
    const flash = (label: string) => {
      setCopied(label);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(null);
      }, COPIED_MS);
    };
    const clip = (navigator.clipboard as Clipboard | undefined)?.writeText(text);
    if (clip === undefined) flash("Couldn't copy");
    else
      clip.then(
        () => {
          flash("Copied");
        },
        () => {
          flash("Couldn't copy");
        },
      );
  }, [text]);
  return { copied, copy };
}

/** Copy, regenerate and cancel for one link; `onUpdated` receives the changed visit. */
export function useLinkActions(
  visit: VisitSummary,
  onUpdated: (v: VisitSummary) => void,
): LinkActionsState {
  const { user } = useSession();
  const { copied, copy } = useCopy(visit.url);
  const regen = useRepoMutation(regenerateFn);
  const cancelM = useRepoMutation(cancelFn);
  const active = cancelM.status === "idle" ? regen : cancelM;

  const regenerate = useCallback(async () => {
    const r = await regen.run(visit.id);
    if (r.ok) onUpdated(r.value);
  }, [regen, visit.id, onUpdated]);

  const cancel = useCallback(async () => {
    const r = await cancelM.run(visit.id);
    if (r.ok) onUpdated(r.value);
    return r.ok;
  }, [cancelM, visit.id, onUpdated]);

  const reset = useCallback(() => {
    regen.reset();
    cancelM.reset();
  }, [regen, cancelM]);

  const canManage = visit.isMine || user?.role === "admin";

  return {
    copied,
    canManage,
    status: active.status,
    error: active.error,
    copy,
    regenerate,
    cancel,
    reset,
  };
}
