import { Button } from "@/components/ui/button";
import type { AlertFilter } from "./useAlerts";

const OPTIONS: { value: AlertFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "contacted", label: "Contacted" },
  { value: "resolved", label: "Resolved" },
];

export function AlertFilterBar({
  value,
  onChange,
}: {
  value: AlertFilter;
  onChange: (v: AlertFilter) => void;
}) {
  return (
    <div role="group" aria-label="Status filter" className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          type="button"
          variant={value === o.value ? "default" : "outline"}
          aria-pressed={value === o.value}
          className="h-12"
          onClick={() => {
            onChange(o.value);
          }}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
