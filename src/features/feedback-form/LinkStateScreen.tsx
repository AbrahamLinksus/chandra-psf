import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  CircleCheckIcon,
  ClockIcon,
  MessageCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { FormContext } from "@/data/access/repos/feedback";

export type LinkState = Exclude<FormContext, { state: "ready" }>["state"] | "already" | "error";

export const REPLACED_TITLE = "A newer link was sent to you on WhatsApp";
export const BUSY_TITLE = "Too many requests, try again in a few minutes";

interface Content {
  icon: LucideIcon;
  title: string;
  hint?: string;
}

function content(state: LinkState, replaced: boolean): Content {
  switch (state) {
    case "expired":
      return replaced
        ? { icon: MessageCircleIcon, title: REPLACED_TITLE, hint: "Please use the newest link." }
        : {
            icon: ClockIcon,
            title: "This feedback link has expired. Please contact Chandra Honda.",
          };
    case "completed":
    case "already":
      return { icon: CircleCheckIcon, title: "Thank you — already submitted" };
    case "rate_limited":
      return { icon: ClockIcon, title: BUSY_TITLE };
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
  const retryable = (state === "error" || state === "rate_limited") && onRetry !== undefined;
  return (
    <div role={state === "error" ? "alert" : "status"} className="flex flex-col items-center">
      <EmptyState icon={icon} title={title} {...(hint === undefined ? {} : { hint })} />
      {retryable && (
        <Button type="button" className="h-12" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
