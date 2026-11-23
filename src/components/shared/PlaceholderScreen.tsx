import { ConstructionIcon } from "lucide-react";
import { EmptyState } from "./EmptyState";

/** Placeholder; each feature task replaces the page that renders it. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
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
