"use client";

import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import type { VisitSummary } from "@/data/access";
import { JobCardDetails } from "./JobCardDetails";
import { LinkCard } from "./LinkCard";
import type { useNewLink } from "./useNewLink";

interface Props {
  s: ReturnType<typeof useNewLink>;
  onUpdated: (v: VisitSummary) => void;
}

/** Details card of the found job card, then Generate link or the current link. */
export function FoundCardSection({ s, onUpdated }: Props) {
  if (s.found === null) return null;
  const shown = s.link ?? s.found.current;
  const canGenerate = shown === null && s.found.jobCard.editable;
  return (
    <>
      <JobCardDetails
        card={s.found.jobCard}
        phone={s.phone}
        onPhone={s.setPhone}
        phoneEditable={shown === null}
      />
      {canGenerate && (
        <div className="grid gap-2">
          <Button
            className="h-12"
            disabled={s.createM.status === "saving"}
            onClick={() => void s.generate()}
          >
            Generate link
          </Button>
          <SaveState
            status={s.createM.status}
            error={s.createM.error}
            onRetry={() => void s.generate()}
          />
        </div>
      )}
      {shown !== null && (
        <ul className="grid min-w-0">
          <LinkCard visit={shown} sendLabel="Send on WhatsApp" onUpdated={onUpdated} />
        </ul>
      )}
    </>
  );
}
