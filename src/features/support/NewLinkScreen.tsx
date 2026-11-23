"use client";

import { useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VisitSummary } from "@/data/access";
import { JobCardDetails } from "./JobCardDetails";
import { LinkCard } from "./LinkCard";
import { useNewLink } from "./useNewLink";

export function NewLinkScreen() {
  const [no, setNo] = useState("");
  const s = useNewLink();
  const shown = s.link ?? s.found?.current ?? null;
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    void s.lookup(no);
  };
  const updated = (v: VisitSummary) => {
    if (v.status === "cancelled") void s.lookup(v.jobCardNo);
    else s.setLink(v);
  };
  return (
    <main className="mx-auto grid max-w-2xl grid-cols-1 gap-4 p-4 sm:p-6">
      <Button asChild variant="ghost" className="h-12 w-fit">
        <Link href="/support">
          <ArrowLeftIcon aria-hidden /> My links
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold">New feedback link</h1>
      <form onSubmit={submit} className="grid gap-2">
        <Label htmlFor="job-card-no">Job card number</Label>
        <div className="flex gap-2">
          <Input
            id="job-card-no"
            className="h-12"
            value={no}
            placeholder="JC-24-1042"
            onChange={(e) => {
              setNo(e.target.value);
            }}
          />
          <Button type="submit" className="h-12">
            Look up
          </Button>
        </div>
        {s.lookupError !== null && (
          <p role="alert" className="text-sm text-danger">
            {s.lookupError}
          </p>
        )}
      </form>
      {s.found !== null && (
        <>
          <JobCardDetails
            card={s.found.jobCard}
            phone={s.phone}
            onPhone={s.setPhone}
            phoneEditable={shown === null}
          />
          {shown === null ? (
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
          ) : (
            <ul className="grid min-w-0">
              <LinkCard visit={shown} sendLabel="Send on WhatsApp" onUpdated={updated} />
            </ul>
          )}
        </>
      )}
    </main>
  );
}
