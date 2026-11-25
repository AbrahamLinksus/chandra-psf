import { Checkbox } from "@/components/ui/checkbox";
import type { CustomerRow as Row } from "@/data/access/repos/customers";
import { formatISTDate } from "@/domain/time";

export function CustomerResultRow({
  row,
  checked,
  onToggle,
}: {
  row: Row;
  checked: boolean;
  onToggle: () => void;
}) {
  const label = `${row.customerName ?? "Erased customer"} · ${row.branchName} · ${formatISTDate(row.serviceDate, { year: true })}`;
  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        disabled={row.erased}
        aria-label={`Select ${label}`}
        className="size-6"
      />
      <span className="min-w-0 break-words">
        {label}
        {row.regNo !== null && <span className="text-muted-foreground"> · {row.regNo}</span>}
      </span>
    </li>
  );
}
