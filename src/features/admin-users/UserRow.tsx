import { Button } from "@/components/ui/button";
import type { User } from "@/domain/types";
import { formatIST } from "@/domain/time";
import { ROLE_LABELS } from "./userForm";
import { canEdit, canManage } from "./userPermissions";

export interface UserRowProps {
  user: User;
  me: User;
  busy: boolean;
  onToggle: (user: User, active: boolean) => void;
  onEdit: (user: User) => void;
  onReset: (user: User) => void;
}

export function UserRow({ user, me, busy, onToggle, onEdit, onReset }: UserRowProps) {
  const manage = canManage(me, user);
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
          {ROLE_LABELS[user.role]}
          {user.branchName === null ? "" : ` · ${user.branchName}`} · Added{" "}
          {formatIST(user.createdAt)}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className={user.active ? "text-sm text-success" : "text-sm text-muted-foreground"}>
          {user.active ? "Active" : "Inactive"}
        </span>
        {me.id === user.id && <span className="text-sm text-muted-foreground">You</span>}
        {canEdit(me, user) && (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => {
              onEdit(user);
            }}
          >
            Edit
          </Button>
        )}
        {manage && (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => {
              onReset(user);
            }}
          >
            Reset password
          </Button>
        )}
        {manage && (
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
