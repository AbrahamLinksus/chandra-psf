import {
  BarChart3Icon,
  BellIcon,
  ClipboardListIcon,
  HistoryIcon,
  TrashIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** shows the open-alerts count */
  badge?: boolean;
  /** one of the three bottom tabs on mobile; the rest sit under "More" */
  tab: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: BarChart3Icon, tab: true },
  { href: "/admin/alerts", label: "Alerts", icon: BellIcon, badge: true, tab: true },
  { href: "/admin/responses", label: "Responses", icon: ClipboardListIcon, tab: true },
  { href: "/admin/responses/deleted", label: "Recently deleted", icon: TrashIcon, tab: false },
  { href: "/admin/audit", label: "Audit", icon: HistoryIcon, tab: false },
  { href: "/admin/users", label: "Users", icon: UsersIcon, tab: false },
];

/** The nav item whose route is the longest prefix of `pathname`. */
export function activeNavHref(pathname: string): string | null {
  const hits = ADMIN_NAV.filter(
    (i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(`${i.href}/`)),
  );
  const best = hits.sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href ?? null;
}
