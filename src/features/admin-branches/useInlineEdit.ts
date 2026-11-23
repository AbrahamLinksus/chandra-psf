"use client";

import { useState } from "react";
import type { RepoError } from "@/data/access";

/** Open/close + draft + inline error for a row rename; `save` returns the error or null. */
export function useInlineEdit<T>(
  initial: T,
  save: (value: T) => Promise<RepoError | null>,
  message: (e: RepoError) => string | null,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setDraft(initial);
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError(null);
  };
  const submit = async () => {
    const failure = await save(draft);
    if (failure === null) {
      setEditing(false);
      setError(null);
    } else {
      setError(message(failure) ?? failure.message);
    }
  };
  return { editing, draft, setDraft, error, open, cancel, submit };
}
