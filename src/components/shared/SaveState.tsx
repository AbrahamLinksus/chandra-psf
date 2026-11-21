import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RepoError } from "@/data/access";

export interface SaveStateProps {
  status: "idle" | "saving" | "error" | "done";
  error?: RepoError | undefined;
  onRetry: () => void;
}

/** Saving spinner, or "Couldn't save, try again" with Retry (S-13). Renders nothing otherwise. */
export function SaveState({ status, error, onRetry }: SaveStateProps) {
  if (status === "saving") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden /> Saving…
      </p>
    );
  }
  if (status !== "error") return null;
  const message =
    error?.code === "SAVE_FAILED" || error === undefined
      ? "Couldn't save, try again"
      : error.message;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
      <span>{message}</span>
      <Button type="button" variant="outline" className="h-12" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
