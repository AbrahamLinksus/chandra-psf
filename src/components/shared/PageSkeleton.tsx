import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="grid gap-4 p-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full max-w-xl" />
      <Skeleton className="h-24 w-full max-w-xl" />
    </div>
  );
}
