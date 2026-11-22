import { BanIcon, CircleCheckIcon, ClockIcon, TriangleAlertIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { FormContext } from "@/data/access/repos/feedback";

export type LinkState = Exclude<FormContext, { state: "ready" }>["state"] | "already" | "error";

const REPLACED_HINT = "A newer link was sent to you on WhatsApp";

function content(state: LinkState, replaced: boolean) {
  switch (state) {
    case "expired":
      return {
        icon: ClockIcon,
        title: "This feedback link has expired. Please contact Chandra Honda.",
        hint: replaced ? REPLACED_HINT : undefined,
      };
    case "completed":
    case "already":
      return { icon: CircleCheckIcon, title: "Thank you — already submitted", hint: undefined };
    case "error":
      return {
        icon: TriangleAlertIcon,
        title: "Couldn't load this page",
        hint: "Please check your connection and try again.",
      };
    case "invalid":
      return { icon: BanIcon, title: "Link not valid", hint: "Please contact Chandra Honda." };
  }
}

export interface LinkStateScreenProps {
  state: LinkState;
  replaced?: boolean;
  onRetry?: () => void;
}

export function LinkStateScreen({ state, replaced = false, onRetry }: LinkStateScreenProps) {
  const { icon, title, hint } = content(state, replaced);
  return (
    <div role={state === "error" ? "alert" : "status"} className="flex flex-col items-center">
      <EmptyState icon={icon} title={title} {...(hint === undefined ? {} : { hint })} />
      {state === "error" && onRetry !== undefined && (
        <Button type="button" className="h-12" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
