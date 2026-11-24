"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VisitSummary } from "@/data/access";
import { FoundCardSection } from "./FoundCardSection";
import { JobCardForm } from "./JobCardForm";
import { LookupBar } from "./LookupBar";
import { MissingCard } from "./MissingCard";
import { useNewLink } from "./useNewLink";

export function NewLinkScreen() {
  const [no, setNo] = useState("");
  const s = useNewLink();
  const updated = (v: VisitSummary) => {
    if (v.status === "cancelled") void s.lookup(v.jobCardNo);
    else s.setLink(v);
  };
  const openExisting = (n: string) => {
    setNo(n);
    void s.lookup(n);
  };
  return (
    <main className="mx-auto grid max-w-2xl grid-cols-1 gap-4 p-4 sm:p-6">
      <Button asChild variant="ghost" className="h-12 w-fit">
        <Link href="/support">
          <ArrowLeftIcon aria-hidden /> My links
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold">New feedback link</h1>
      <LookupBar
        value={no}
        onChange={setNo}
        onLookup={() => void s.lookup(no)}
        looking={s.looking}
        error={s.lookupError}
      />
      {s.missingNo !== null && (
        <MissingCard
          no={s.missingNo}
          onNew={() => {
            if (s.missingNo !== null) s.openForm(s.missingNo);
          }}
        />
      )}
      {s.formNo !== null && (
        <JobCardForm
          key={s.formNo}
          initialNo={s.formNo}
          onSaved={s.saved}
          onCancel={s.closeForm}
          onOpenExisting={openExisting}
        />
      )}
      <FoundCardSection s={s} onUpdated={updated} />
    </main>
  );
}
