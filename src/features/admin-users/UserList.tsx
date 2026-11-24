"use client";

import { useState } from "react";
import type { User } from "@/domain/types";
import { EditUserDialog } from "./EditUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { UserRow } from "./UserRow";

export interface UserListProps {
  me: User;
  users: User[];
  busy: boolean;
  onToggle: (user: User, active: boolean) => void;
}

/** The rows plus the Edit and Reset password dialogs they open. */
export function UserList({ me, users, busy, onToggle }: UserListProps) {
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  return (
    <>
      <ul className="grid gap-2">
        {users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            me={me}
            busy={busy}
            onToggle={onToggle}
            onEdit={setEditing}
            onReset={setResetting}
          />
        ))}
      </ul>
      {editing !== null && (
        <EditUserDialog
          key={editing.id}
          me={me}
          user={editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      {resetting !== null && (
        <ResetPasswordDialog
          key={resetting.id}
          user={resetting}
          onClose={() => {
            setResetting(null);
          }}
        />
      )}
    </>
  );
}
