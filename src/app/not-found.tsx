import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6">
      <EmptyState
        icon={CompassIcon}
        title="We couldn't find that page"
        hint="The link may be wrong or out of date."
      />
      <Button asChild className="h-12">
        <Link href="/sign-in">Go to sign in</Link>
      </Button>
    </main>
  );
}
