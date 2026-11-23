import {
  BarChart3Icon,
  BellIcon,
  Building2Icon,
  ClipboardListIcon,
  HistoryIcon,
  UserCircleIcon,
  UserSearchIcon,
  WrenchIcon,
  TrashIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { StaffRole } from "@/domain/roles";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** shows the open-alerts count */
  badge?: boolean;
  /** one of the three bottom tabs on mobile; the rest sit under "More" */
  tab: boolean;
  /** admin roles that see the item; all admins when omitted */
  only?: StaffRole;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: BarChart3Icon, tab: true },
  { href: "/admin/alerts", label: "Alerts", icon: BellIcon, badge: true, tab: true },
  { href: "/admin/responses", label: "Responses", icon: ClipboardListIcon, tab: true },
  { href: "/admin/responses/deleted", label: "Recently deleted", icon: TrashIcon, tab: false },
  { href: "/admin/audit", label: "Audit", icon: HistoryIcon, tab: false },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: UserSearchIcon,
    tab: false,
    only: "main_admin",
  },
  { href: "/admin/users", label: "Users", icon: UsersIcon, tab: false },
  {
    href: "/admin/branches",
    label: "Branches",
    icon: Building2Icon,
    tab: false,
    only: "main_admin",
  },
  {
    href: "/admin/advisors",
    label: "Advisors",
    icon: WrenchIcon,
    tab: false,
    only: "branch_admin",
  },
  { href: "/account", label: "My account", icon: UserCircleIcon, tab: false },
];

/** The items this role sees, in display order. */
export function navFor(role: StaffRole | undefined): AdminNavItem[] {
  return ADMIN_NAV.filter((i) => i.only === undefined || i.only === role);
}

/** The nav item whose route is the longest prefix of `pathname`. */
export function activeNavHref(pathname: string, nav: AdminNavItem[] = ADMIN_NAV): string | null {
  const hits = nav.filter(
    (i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(`${i.href}/`)),
  );
  const best = hits.sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href ?? null;
}
