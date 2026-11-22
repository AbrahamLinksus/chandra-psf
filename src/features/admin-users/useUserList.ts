"use client";

import { useState } from "react";
import type { User } from "@/domain/types";
import { useRepoMutation } from "@/hooks/useRepoMutation";
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
  const mutation = useRepoMutation((da, c: ActiveChange) =>
    da.users.setUserActive(c.user.id, c.active),
  );

  const apply = async (change: ActiveChange) => {
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
    meId: me?.id,
    pending,
    mutation,
    request,
    confirm: () => {
      if (pending !== null) void apply(pending);
    },
    close,
  };
}
