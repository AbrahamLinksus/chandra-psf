"use client";

import { useCallback, useState } from "react";
import type { DataAccess, Result, VisitSummary } from "@/data/access";
import type { JobCard } from "@/domain/types";
import { useRepoMutation } from "@/hooks/useRepoMutation";

export interface FoundCard {
  jobCard: JobCard & { advisorName: string };
  current: VisitSummary | null;
}

const lookupFn = (da: DataAccess, no: string): Promise<Result<FoundCard>> =>
  da.jobCards.getJobCard(no);
const createFn = (
  da: DataAccess,
  i: { jobCardNo: string; phone: string | null },
): Promise<Result<VisitSummary>> => da.visits.createVisitLink(i);

/** State for the New feedback link screen: lookup, editable phone, generate. */
export function useNewLink() {
  const [found, setFound] = useState<FoundCard | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [link, setLink] = useState<VisitSummary | null>(null);
  const lookupM = useRepoMutation(lookupFn);
  const createM = useRepoMutation(createFn);

  const lookup = useCallback(
    async (no: string) => {
      const r = await lookupM.run(no);
      setLink(null);
      createM.reset();
      setLookupError(r.ok ? null : r.error.message);
      setFound(r.ok ? r.value : null);
      if (r.ok) setPhone(r.value.current?.phone ?? r.value.jobCard.phone ?? "");
    },
    [lookupM, createM],
  );

  const generate = useCallback(async () => {
    if (found === null) return;
    const r = await createM.run({ jobCardNo: found.jobCard.jobCardNo, phone });
    if (r.ok) setLink(r.value);
    else if (r.error.code === "CONFLICT") await lookup(found.jobCard.jobCardNo);
  }, [found, phone, createM, lookup]);

  return {
    found,
    lookupError,
    phone,
    setPhone,
    link,
    setLink,
    lookup,
    generate,
    createM,
  };
}
