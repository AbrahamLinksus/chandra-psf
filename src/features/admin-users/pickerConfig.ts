import type { Role, User } from "@/domain/types";
import { ALL_ROLES, ROLE_LABELS, type UserDraft } from "./userForm";
import type { BranchOption } from "./useBranchOptions";

export interface Option {
  value: string;
  label: string;
}

export interface PickerConfig {
  roles: Option[];
  branches: Option[];
  showBranch: boolean;
  branchLocked: boolean;
  /** Main admin picking a branch-bound role while no active branch exists. */
  noBranches: boolean;
}

const roleOption = (r: Role): Option => ({ value: r, label: ROLE_LABELS[r] });

/** What the role and branch pickers offer this signed-in admin (G-5, G-9). */
export function pickerConfig(
  me: User,
  draft: Pick<UserDraft, "role">,
  branches: BranchOption[],
  branchesLoading: boolean,
): PickerConfig {
  if (me.role !== "main_admin") {
    const own = me.branchId === null ? [] : [{ value: me.branchId, label: me.branchName ?? "" }];
    return {
      roles: [roleOption("support")],
      branches: own,
      showBranch: true,
      branchLocked: true,
      noBranches: false,
    };
  }
  const needsBranch = draft.role !== "main_admin";
  return {
    roles: ALL_ROLES.map(roleOption),
    branches: branches.map((b) => ({ value: b.id, label: b.name })),
    showBranch: needsBranch,
    branchLocked: false,
    noBranches: needsBranch && !branchesLoading && branches.length === 0,
  };
}
