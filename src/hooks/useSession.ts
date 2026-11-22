"use client";

import type { User } from "@/domain/types";
import { useRepoQuery } from "./useRepoQuery";

export const SESSION_KEY = ["session"] as const;

export function useSession(): { user: User | null; isLoading: boolean } {
  const { data, isLoading } = useRepoQuery(SESSION_KEY, (da) => da.auth.currentUser());
  return { user: data ?? null, isLoading };
}
