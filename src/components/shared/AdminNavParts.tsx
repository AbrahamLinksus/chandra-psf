import { MoreHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminNavLink } from "./AdminNavLink";
import { ADMIN_NAV } from "./adminNav";
import { DemoLabel } from "./DemoLabel";

interface NavProps {
  active: string | null;
  count: number;
}

export function AdminSidebar({ active, count, actions }: NavProps & { actions: ReactNode }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r bg-card p-4 md:flex">
      <span className="font-semibold">Chandra Honda PSF</span>
      <DemoLabel />
      <nav aria-label="Admin" className="grid gap-1">
        {ADMIN_NAV.map((item) => (
          <AdminNavLink
            key={item.href}
            item={item}
            active={item.href === active}
            count={count}
            layout="row"
          />
        ))}
      </nav>
      <div className="mt-auto border-t pt-3">{actions}</div>
    </aside>
  );
}

export function AdminTabBar({ active, count, onMore }: NavProps & { onMore: () => void }) {
  return (
    <nav
      aria-label="Admin tabs"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card md:hidden"
    >
      {ADMIN_NAV.filter((i) => i.tab).map((item) => (
        <AdminNavLink
          key={item.href}
          item={item}
          active={item.href === active}
          count={count}
          layout="tab"
        />
      ))}
      <button
        type="button"
        onClick={onMore}
        className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground hover:bg-accent"
      >
        <MoreHorizontalIcon className="size-5" aria-hidden />
        More
      </button>
    </nav>
  );
}

interface MoreProps extends NavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ReactNode;
}

export function AdminMoreSheet({ open, onOpenChange, active, count, actions }: MoreProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-2 p-4">
        <SheetHeader className="p-0">
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        {ADMIN_NAV.filter((i) => !i.tab).map((item) => (
          <AdminNavLink
            key={item.href}
            item={item}
            active={item.href === active}
            count={count}
            layout="row"
            onNavigate={() => {
              onOpenChange(false);
            }}
          />
        ))}
        <div className="border-t pt-2">{actions}</div>
      </SheetContent>
    </Sheet>
  );
}
