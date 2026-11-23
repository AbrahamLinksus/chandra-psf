"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { StaffRole } from "@/domain/roles";
import { useSession } from "@/hooks/useSession";
import type { User } from "@/domain/types";
import { PageSkeleton } from "./PageSkeleton";

/** Where a signed-in or anonymous visitor must go instead of seeing the page; null = allowed. */
export function guardRedirect(user: User | null, allowed: readonly StaffRole[]): string | null {
  if (user === null) return "/sign-in";
  if (user.mustSetPassword) return "/set-password";
  if (!allowed.includes(user.role)) return "/not-allowed";
  return null;
}

/** UI redirect only; the repositories enforce roles. */
export function RoleGuard({
  allowed,
  children,
}: {
  allowed: readonly StaffRole[];
  children: ReactNode;
}) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const target = isLoading ? "pending" : guardRedirect(user, allowed);

  useEffect(() => {
    if (target !== null && target !== "pending") router.replace(target);
  }, [target, router]);

  return target === null ? <>{children}</> : <PageSkeleton />;
}
