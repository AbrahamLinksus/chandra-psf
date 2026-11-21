import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AdminNavItem } from "./adminNav";

export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="bg-brand text-brand-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold"
      aria-label={`${String(count)} open`}
    >
      {count}
    </span>
  );
}

interface Props {
  item: AdminNavItem;
  active: boolean;
  count: number;
  layout: "row" | "tab";
  onNavigate?: (() => void) | undefined;
}

const ROW = "h-12 justify-start gap-3 rounded-lg px-3";
const TAB = "h-14 flex-1 flex-col justify-center gap-0.5 text-xs";

function TabDot({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="bg-brand absolute -top-1 -right-2 size-2.5 rounded-full" aria-hidden />;
}

function linkClass(row: boolean, active: boolean): string {
  return cn(
    "flex items-center text-sm font-medium transition-colors hover:bg-accent",
    row ? ROW : TAB,
    active ? "text-brand" : "text-muted-foreground",
    active && row && "bg-accent",
  );
}

export function AdminNavLink({ item, active, count, layout, onNavigate }: Props) {
  const Icon = item.icon;
  const row = layout === "row";
  const hasBadge = item.badge === true;
  return (
    <Link
      href={item.href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      aria-current={active ? "page" : undefined}
      className={linkClass(row, active)}
    >
      <span className="relative flex items-center">
        <Icon className="size-5" aria-hidden />
        <TabDot show={!row && hasBadge && count > 0} />
      </span>
      <span>{item.label}</span>
      {row && hasBadge && <CountBadge count={count} />}
    </Link>
  );
}
