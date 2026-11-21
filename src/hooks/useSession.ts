"use client";

import type { User } from "@/domain/types";
import { useRepoQuery } from "./useRepoQuery";

export function useSession(): { user: User | null; isLoading: boolean } {
  const { data, isLoading } = useRepoQuery(["session"], (da) => da.auth.currentUser());
  return { user: data ?? null, isLoading };
}
