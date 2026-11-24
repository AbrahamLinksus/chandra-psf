"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FeedbackFlowScreen } from "./FeedbackFlowScreen";
import { LinkStateScreen } from "./LinkStateScreen";
import { useFormContext } from "./useFormContext";

function Body({ token }: { token: string }) {
  const { state, reload } = useFormContext(token);
  if (state.status === "loading") {
    return (
      <div className="space-y-4 py-10" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (state.status === "error") return <LinkStateScreen state="error" onRetry={reload} />;
  const ctx = state.context;
  if (ctx.state === "ready") return <FeedbackFlowScreen token={token} context={ctx} />;
  return (
    <LinkStateScreen
      state={ctx.state}
      replaced={ctx.state === "expired" && ctx.replaced}
      onRetry={reload}
    />
  );
}

/** Public customer form for /f/[token]. */
export function FeedbackFormScreen({ token }: { token: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4">
      <Body token={token} />
    </main>
  );
}
