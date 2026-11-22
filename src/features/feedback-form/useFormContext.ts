"use client";

import { useCallback, useEffect, useState } from "react";
import { useDataAccess } from "@/data/access/provider";
import type { FormContext } from "@/data/access/repos/feedback";

export type FormContextState =
  { status: "loading" } | { status: "error" } | { status: "loaded"; context: FormContext };

/**
 * Loads the link once. It deliberately does not follow live invalidation: after Submit the visit
 * becomes Completed, but the customer must still see the thank-you screen.
 */
export function useFormContext(token: string): { state: FormContextState; reload: () => void } {
  const data = useDataAccess();
  const [state, setState] = useState<FormContextState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    data.feedback
      .getVisitByToken(token)
      .then((r) => {
        if (live) setState(r.ok ? { status: "loaded", context: r.value } : { status: "error" });
      })
      .catch(() => {
        if (live) setState({ status: "error" });
      });
    return () => {
      live = false;
    };
  }, [data, token, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { state, reload };
}
