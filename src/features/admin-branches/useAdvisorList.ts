"use client";

import { useState, type SyntheticEvent } from "react";
import type { RepoError } from "@/data/access";
import { useRefreshingMutation } from "./useRefreshingMutation";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { fieldMessage } from "./branchMessages";

function useAddAdvisor(branchId: string | undefined) {
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const add = useRefreshingMutation((da, i: { branchId: string; name: string }) =>
    da.advisors.createAdvisor(i),
  );
  const submit = async () => {
    if (branchId === undefined) return;
    setAddError(null);
    const r = await add.run({ branchId, name });
    if (r.ok) {
      setName("");
      return;
    }
    const message = fieldMessage(r.error, "advisor");
    if (message !== null) {
      setAddError(message);
      add.reset();
    }
  };
  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    void submit();
  };
  return { name, setName, addError, add, onSubmit, retryAdd: submit };
}

/** Advisors of one branch (or the caller's own scope): list, add, rename, deactivate / reactivate. */
export function useAdvisorList(branchId: string | undefined) {
  const query = useRepoQuery(["advisors", "list", branchId ?? "own"], (da) =>
    da.advisors.listAdvisors(branchId === undefined ? {} : { branchId }),
  );
  const adder = useAddAdvisor(branchId);
  const rename = useRefreshingMutation((da, i: { id: string; name: string }) =>
    da.advisors.renameAdvisor(i.id, i.name),
  );
  const toggle = useRefreshingMutation((da, i: { id: string; active: boolean }) =>
    da.advisors.setAdvisorActive(i.id, i.active),
  );

  const renameAdvisor = async (id: string, value: string): Promise<RepoError | null> => {
    const r = await rename.run({ id, name: value });
    return r.ok ? null : r.error;
  };

  return {
    advisors: query.data,
    error: query.error,
    isLoading: query.isLoading,
    ...adder,
    toggle,
    busy: [adder.add, rename, toggle].some((m) => m.status === "saving"),
    renameAdvisor,
    setActive: (id: string, active: boolean) => {
      void toggle.run({ id, active });
    },
  };
}
