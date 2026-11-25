"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/domain/types";

const ALL = "all";

export interface BranchFilterProps {
  branches: Branch[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}

/** Main admins only: the caller renders this only when options.branches exists. */
export function BranchFilter({ branches, value, onChange }: BranchFilterProps) {
  return (
    <div className="grid max-w-xs gap-1.5">
      <Label>Branch</Label>
      <Select
        value={value ?? ALL}
        onValueChange={(v) => {
          onChange(v === ALL ? undefined : v);
        }}
      >
        <SelectTrigger className="h-12 w-full" aria-label="Branch">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All branches</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
