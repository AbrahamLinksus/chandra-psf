"use client";

import { useState } from "react";
import { CopyIcon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { FEEDBACK_RECEIVED, NEEDS_MOBILE } from "./messages";
import type { LinkActionsState } from "./useLinkActions";
import { WhatsAppIcon } from "./WhatsAppIcon";

const WA_CLASS = "h-12 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90";

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

function SendOrResend({ a }: { a: LinkActionsState }) {
  const { visit, issued } = a;
  if (issued !== null) {
    return (
      <>
        <SendButton url={issued.whatsappUrl} label="Send on WhatsApp" />
        <Button type="button" variant="outline" className="h-12" onClick={a.copy}>
          <CopyIcon aria-hidden /> {a.copied ?? "Copy link"}
        </Button>
      </>
    );
  }
  if (visit.status === "expired") return null;
  return (
    <Button
      type="button"
      disabled={visit.phone === null}
      className={WA_CLASS}
      onClick={() => void a.resend()}
    >
      <WhatsAppIcon /> Resend
    </Button>
  );
}

/** Send, copy, resend, regenerate and cancel for one link (US-04, US-06). */
export function LinkActions({ a }: { a: LinkActionsState }) {
  const [confirming, setConfirming] = useState(false);
  const { visit, issued } = a;
  if (visit.status === "completed") {
    return <p className="text-sm font-medium text-success">{FEEDBACK_RECEIVED}</p>;
  }
  if (visit.status === "cancelled") return null;
  const noMobile = issued === null ? visit.phone === null : issued.whatsappUrl === null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <SendOrResend a={a} />
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
      </div>
      {noMobile && <p className="text-sm text-muted-foreground">{NEEDS_MOBILE}</p>}
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
