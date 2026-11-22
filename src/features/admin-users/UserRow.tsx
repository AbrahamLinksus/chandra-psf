import { Button } from "@/components/ui/button";
import type { User } from "@/domain/types";
import { formatIST } from "@/domain/time";

export interface UserRowProps {
  user: User;
  isSelf: boolean;
  busy: boolean;
  onToggle: (user: User, active: boolean) => void;
}

export function UserRow({ user, isSelf, busy, onToggle }: UserRowProps) {
  return (
    <li
      data-user-email={user.email}
      data-active={user.active}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
    >
      <span className="grid gap-0.5">
        <span className="font-medium">{user.name}</span>
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <span className="text-xs text-muted-foreground">
          {user.role === "admin" ? "Admin" : "Support"} · Added {formatIST(user.createdAt)}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className={user.active ? "text-sm text-success" : "text-sm text-muted-foreground"}>
          {user.active ? "Active" : "Inactive"}
        </span>
        {isSelf ? (
          <span className="text-sm text-muted-foreground">You</span>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            disabled={busy}
            onClick={() => {
              onToggle(user, !user.active);
            }}
          >
            {user.active ? "Deactivate" : "Reactivate"}
          </Button>
        )}
      </span>
    </li>
  );
}
