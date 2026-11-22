"use client";

import { useState } from "react";
import { CopyIcon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import type { VisitSummary } from "@/data/access";
import { NEEDS_MOBILE } from "./messages";
import { useLinkActions } from "./useLinkActions";
import { WhatsAppIcon } from "./WhatsAppIcon";

export const NOT_MINE = "This link was sent by another team member";

const WA_CLASS = "h-12 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90";

interface LinkActionsProps {
  visit: VisitSummary;
  sendLabel: string;
  onUpdated: (v: VisitSummary) => void;
}

function SendButton({ url, label }: { url: string | null; label: string }) {
  if (url === null) {
    return (
      <Button type="button" disabled className={WA_CLASS}>
        <WhatsAppIcon /> {label}
      </Button>
    );
  }
  return (
    <Button asChild className={WA_CLASS}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon /> {label}
      </a>
    </Button>
  );
}

/** Send, copy, regenerate and cancel for one link (US-04, US-06). */
export function LinkActions({ visit, sendLabel, onUpdated }: LinkActionsProps) {
  const a = useLinkActions(visit, onUpdated);
  const [confirming, setConfirming] = useState(false);
  if (visit.status === "completed") {
    return <p className="text-sm font-medium text-success">Feedback already received</p>;
  }
  if (!a.canManage) {
    return <p className="text-sm text-muted-foreground">{NOT_MINE}</p>;
  }
  const replaceable = visit.status !== "cancelled";
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {replaceable && <SendButton url={visit.whatsappUrl} label={sendLabel} />}
        {replaceable && (
          <Button type="button" variant="outline" className="h-12" onClick={a.copy}>
            <CopyIcon aria-hidden /> {a.copied ?? "Copy link"}
          </Button>
        )}
        {replaceable && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => void a.regenerate()}
            >
              <RefreshCwIcon aria-hidden /> Regenerate
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => {
                setConfirming(true);
              }}
            >
              <XCircleIcon aria-hidden /> Cancel link
            </Button>
          </>
        )}
      </div>
      {replaceable && visit.whatsappUrl === null && (
        <p className="text-sm text-muted-foreground">{NEEDS_MOBILE}</p>
      )}
      <SaveState status={confirming ? "idle" : a.status} error={a.error} onRetry={a.reset} />
      <ConfirmDialog
        open={confirming}
        title="Cancel this link?"
        body="The customer will no longer be able to open it."
        confirmLabel="Cancel link"
        destructive
        status={<SaveState status={a.status} error={a.error} onRetry={a.reset} />}
        onConfirm={() =>
          void a.cancel().then((done) => {
            if (done) setConfirming(false);
          })
        }
        onClose={() => {
          setConfirming(false);
          a.reset();
        }}
      />
    </div>
  );
}
