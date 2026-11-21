import { PowerIcon, RotateCcwIcon, ZapOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AdminActionsProps {
  onSimulateFailure: () => void;
  onReset: () => void;
  onSignOut: () => void;
}

/** Demo and session actions shown in the sidebar and under "More". */
export function AdminActions({ onSimulateFailure, onReset, onSignOut }: AdminActionsProps) {
  const cls = "h-12 w-full justify-start gap-3 px-3";
  return (
    <div className="grid gap-1">
      <Button variant="ghost" className={cls} onClick={onSimulateFailure}>
        <ZapOffIcon aria-hidden /> Simulate failed save
      </Button>
      <Button variant="ghost" className={cls} onClick={onReset}>
        <RotateCcwIcon aria-hidden /> Reset demo data
      </Button>
      <Button variant="ghost" className={cls} onClick={onSignOut}>
        <PowerIcon aria-hidden /> Sign out
      </Button>
    </div>
  );
}
