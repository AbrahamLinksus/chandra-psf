"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterOptions } from "@/data/access";
import type { Filters } from "@/domain/types";

export interface FilterBarProps {
  value: Filters;
  onChange: (next: Filters) => void;
  options: FilterOptions;
}

const ALL = "all";

interface PickProps {
  label: string;
  value: string | undefined;
  items: { value: string; label: string }[];
  onPick: (v: string | undefined) => void;
}

function Pick({ label, value, items, onPick }: PickProps) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? ALL}
        onValueChange={(v) => {
          onPick(v === ALL ? undefined : v);
        }}
      >
        <SelectTrigger className="h-12 w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField(props: {
  id: string;
  label: string;
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type="date"
        className="h-12"
        value={props.value}
        onChange={(e) => {
          props.onPick(e.target.value);
        }}
      />
    </div>
  );
}

interface OptionalPatch {
  vehicleType?: Filters["vehicleType"] | undefined;
  model?: string | undefined;
  advisorId?: string | undefined;
}

/** Copy of the filters with optional keys replaced; undefined clears a key. */
function withOptional(f: Filters, patch: OptionalPatch): Filters {
  const m = { vehicleType: f.vehicleType, model: f.model, advisorId: f.advisorId, ...patch };
  return {
    from: f.from,
    to: f.to,
    ...(m.vehicleType ? { vehicleType: m.vehicleType } : {}),
    ...(m.model ? { model: m.model } : {}),
    ...(m.advisorId ? { advisorId: m.advisorId } : {}),
  };
}

export function FilterBar({ value, onChange, options }: FilterBarProps) {
  const patch = (p: OptionalPatch) => {
    onChange(withOptional(value, p));
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <DateField
        id="filter-from"
        label="From"
        value={value.from}
        onPick={(from) => {
          onChange({ ...value, from });
        }}
      />
      <DateField
        id="filter-to"
        label="To"
        value={value.to}
        onPick={(to) => {
          onChange({ ...value, to });
        }}
      />
      <Pick
        label="Vehicle type"
        value={value.vehicleType}
        items={options.vehicleTypes.map((t) => ({ value: t, label: t }))}
        onPick={(v) => {
          patch({ vehicleType: options.vehicleTypes.find((t) => t === v) });
        }}
      />
      <Pick
        label="Model"
        value={value.model}
        items={options.models.map((m) => ({ value: m, label: m }))}
        onPick={(v) => {
          patch({ model: v });
        }}
      />
      <Pick
        label="Advisor"
        value={value.advisorId}
        items={options.advisors.map((a) => ({ value: a.id, label: a.name }))}
        onPick={(v) => {
          patch({ advisorId: v });
        }}
      />
    </div>
  );
}
