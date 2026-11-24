"use client";

import { useState, type SyntheticEvent } from "react";
import { useRefreshingMutation } from "./useRefreshingMutation";
import { mergeBranch } from "./listCache";
import { fieldMessage } from "./branchMessages";

const EMPTY = { name: "", city: "" };

/** Add-branch form; draft kept on failure, cleared on success. */
export function useAddBranch() {
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const mutation = useRefreshingMutation(
    (da, i: typeof EMPTY) => da.branches.createBranch(i),
    mergeBranch,
  );

  const submit = async () => {
    setError(null);
    const result = await mutation.run(draft);
    if (result.ok) {
      setDraft(EMPTY);
      return;
    }
    const message = fieldMessage(result.error, "branch");
    if (message !== null) {
      setError(message);
      mutation.reset();
    }
  };
  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    void submit();
  };
  const setField = (key: keyof typeof EMPTY, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };
  return { draft, setField, error, mutation, onSubmit, retry: submit };
}
