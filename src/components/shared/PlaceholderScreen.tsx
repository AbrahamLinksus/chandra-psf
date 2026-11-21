import { ConstructionIcon } from "lucide-react";
import { DemoLabel } from "./DemoLabel";
import { EmptyState } from "./EmptyState";

interface PlaceholderScreenProps {
  title: string;
  /** Only for pages outside the admin/support shells, which already show the demo badge. */
  showDemoLabel?: boolean;
}

/** Foundation placeholder; each feature task replaces the page that renders it. */
export function PlaceholderScreen({ title, showDemoLabel = false }: PlaceholderScreenProps) {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {showDemoLabel && <DemoLabel />}
      </div>
      <div className="rounded-2xl border bg-card shadow-sm">
        <EmptyState
          icon={ConstructionIcon}
          title="Coming soon"
          hint="This screen is not built yet."
        />
      </div>
    </main>
  );
}
