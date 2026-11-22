import type { ReactNode } from "react";

interface BlockCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function BlockCard({ title, children, action, className = "" }: BlockCardProps) {
  return (
    <section
      className={`grid min-w-0 grid-cols-1 content-start gap-3 rounded-2xl border bg-card p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function NoData() {
  return <p className="py-6 text-center text-sm text-muted-foreground">—</p>;
}
