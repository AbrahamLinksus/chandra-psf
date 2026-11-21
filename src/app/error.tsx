"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6">
      <EmptyState icon={TriangleAlertIcon} title="Something went wrong" hint="Please try again." />
      <Button className="h-12" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
