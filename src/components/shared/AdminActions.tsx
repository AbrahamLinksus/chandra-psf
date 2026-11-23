import { PowerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Session action shown in the sidebar and under "More". */
export function AdminActions({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="grid gap-1">
      <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3" onClick={onSignOut}>
        <PowerIcon aria-hidden /> Sign out
      </Button>
    </div>
  );
}
