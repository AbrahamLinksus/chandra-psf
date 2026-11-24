"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DataAccess, Result, VisitSummary } from "@/data/access";
import { useRepoMutation, type MutationStatus } from "@/hooks/useRepoMutation";
import type { RepoError } from "@/data/access";
import type { LinkIssued } from "@/data/access/repos/visits";

const COPIED_MS = 2000;

const regenerateFn = (da: DataAccess, id: string): Promise<Result<LinkIssued>> =>
  da.visits.regenerateLink(id);
const resendFn = (da: DataAccess, id: string): Promise<Result<LinkIssued>> =>
  da.visits.resendLink(id);
const cancelFn = (da: DataAccess, id: string): Promise<Result<VisitSummary>> =>
  da.visits.cancelLink(id);

export interface LinkActionsState {
  /** The visit as last changed here (resend, regenerate or cancel), else the one passed in. */
  visit: VisitSummary;
  /** The link code, held in memory only after generate, resend or regenerate; never reloaded. */
  issued: LinkIssued | null;
  /** Button label after a copy attempt, or null before one. */
  copied: string | null;
  status: MutationStatus;
  error: RepoError | undefined;
  copy: () => void;
  resend: () => Promise<void>;
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

/** The three server actions on one link; the latest one's status and error are reported. */
function useLinkMutations(
  id: string,
  onIssued: (i: LinkIssued) => void,
  onCancelled: (v: VisitSummary) => void,
) {
  const resendM = useRepoMutation(resendFn);
  const regen = useRepoMutation(regenerateFn);
  const cancelM = useRepoMutation(cancelFn);
  const active = [cancelM, regen, resendM].find((m) => m.status !== "idle") ?? resendM;

  const reset = useCallback(() => {
    resendM.reset();
    regen.reset();
    cancelM.reset();
  }, [resendM, regen, cancelM]);

  const issue = useCallback(
    async (m: typeof regen) => {
      reset();
      const r = await m.run(id);
      if (r.ok) onIssued(r.value);
    },
    [id, reset, onIssued],
  );

  const cancel = useCallback(async () => {
    reset();
    const r = await cancelM.run(id);
    if (r.ok) onCancelled(r.value);
    return r.ok;
  }, [cancelM, id, onCancelled, reset]);

  return {
    status: active.status,
    error: active.error,
    resend: () => issue(resendM),
    regenerate: () => issue(regen),
    cancel,
    reset,
  };
}

/** Resend, regenerate, copy and cancel for one link; `onCancelled` receives the cancelled visit. */
export function useLinkActions(
  initialVisit: VisitSummary,
  initialIssued: LinkIssued | null,
  onCancelled: (v: VisitSummary) => void,
): LinkActionsState {
  const [issued, setIssued] = useState(initialIssued);
  const [cancelled, setCancelled] = useState<VisitSummary | null>(null);
  const visit = cancelled ?? issued?.visit ?? initialVisit;
  const { copied, copy } = useCopy(issued?.url ?? "");
  const afterCancel = useCallback(
    (v: VisitSummary) => {
      setIssued(null);
      setCancelled(v);
      onCancelled(v);
    },
    [onCancelled],
  );
  const m = useLinkMutations(visit.id, setIssued, afterCancel);
  return { visit, issued, copied, copy, ...m };
}
