"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIONS, ACTION_LABELS } from "./auditFormat";
import type { AuditFilter } from "./useAudit";

export function AuditActionFilter({
  value,
  onChange,
}: {
  value: AuditFilter;
  onChange: (v: AuditFilter) => void;
}) {
  return (
    <div className="grid max-w-xs gap-1.5">
      <Label>Action</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          onChange(ACTIONS.find((a) => a === v) ?? "all");
        }}
      >
        <SelectTrigger className="h-12 w-full" aria-label="Action">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All actions</SelectItem>
          {ACTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {ACTION_LABELS[a]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
