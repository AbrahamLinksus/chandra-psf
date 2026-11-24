"use client";

import { useRef, useState } from "react";
import type { User } from "@/domain/types";
import { useUsersMutation } from "./useUsersMutation";
import { useRepoQuery } from "@/hooks/useRepoQuery";
import { useSession } from "@/hooks/useSession";

interface ActiveChange {
  user: User;
  active: boolean;
}

/** Users list plus deactivate / reactivate; deactivation waits for confirmation. */
export function useUserList() {
  const query = useRepoQuery(["users", "list"], (da) => da.users.listUsers());
  const { user: me } = useSession();
  const [pending, setPending] = useState<ActiveChange | null>(null);
  const mutation = useUsersMutation((da, c: ActiveChange) =>
    da.users.setUserActive(c.user.id, c.active),
  );

  const last = useRef<ActiveChange | null>(null);

  const apply = async (change: ActiveChange) => {
    last.current = change;
    const result = await mutation.run(change);
    if (result.ok) setPending(null);
  };

  const request = (user: User, active: boolean) => {
    mutation.reset();
    if (active) void apply({ user, active });
    else setPending({ user, active });
  };

  const close = () => {
    mutation.reset();
    setPending(null);
  };

  return {
    users: query.data,
    error: query.error,
    isLoading: query.isLoading,
    me: me ?? undefined,
    pending,
    mutation,
    request,
    /** Re-applies the last attempted change (Retry after a failed save). */
    retry: () => {
      if (last.current !== null) void apply(last.current);
    },
    confirm: () => {
      if (pending !== null) void apply(pending);
    },
    close,
  };
}
