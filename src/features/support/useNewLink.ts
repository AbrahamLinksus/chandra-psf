"use client";

import { useCallback, useState } from "react";
import type { DataAccess, Result, VisitSummary } from "@/data/access";
import type { JobCardView } from "@/data/access/repos/jobCards";
import { useRepoMutation } from "@/hooks/useRepoMutation";

export interface FoundCard {
  jobCard: JobCardView;
  current: VisitSummary | null;
}

interface GenerateInput {
  card: JobCardView;
  phone: string;
}

const lookupFn = (da: DataAccess, no: string): Promise<Result<FoundCard>> =>
  da.jobCards.getJobCard(no);

/** Saves a corrected phone on the job card (audited), then creates the link. */
async function generateFn(da: DataAccess, i: GenerateInput): Promise<Result<VisitSummary>> {
  const wanted = i.phone.trim() === "" ? null : i.phone;
  if (i.card.editable && wanted !== i.card.phone) {
    const saved = await da.jobCards.updateJobCard(i.card.id, { phone: wanted });
    if (!saved.ok) return saved;
  }
  return da.visits.createVisitLink({ jobCardNo: i.card.jobCardNo, phone: wanted });
}

/** Lookup of one job card at my branch: the card, the editable phone, or "not found" / an error. */
function useJobCardLookup() {
  const [found, setFound] = useState<FoundCard | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [missingNo, setMissingNo] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const lookupM = useRepoMutation(lookupFn);

  const show = useCallback((card: FoundCard | null) => {
    setFound(card);
    setPhone(card?.current?.phone ?? card?.jobCard.phone ?? "");
  }, []);

  const find = useCallback(
    async (no: string) => {
      const r = await lookupM.run(no);
      const missing = !r.ok && r.error.code === "NOT_FOUND";
      setMissingNo(missing ? no.trim() : null);
      setLookupError(r.ok || missing ? null : r.error.message);
      show(r.ok ? r.value : null);
    },
    [lookupM, show],
  );

  const clear = useCallback(() => {
    setMissingNo(null);
    setLookupError(null);
    setFound(null);
  }, []);

  return {
    found,
    lookupError,
    missingNo,
    phone,
    setPhone,
    show,
    find,
    clear,
    looking: lookupM.status === "saving",
  };
}

/** State for the New feedback link screen: lookup, new job card form, editable phone, generate. */
export function useNewLink() {
  const lk = useJobCardLookup();
  const { found, phone, show, find, clear } = lk;
  const [formNo, setFormNo] = useState<string | null>(null);
  const [link, setLink] = useState<VisitSummary | null>(null);
  const createM = useRepoMutation(generateFn);

  const lookup = useCallback(
    async (no: string) => {
      setLink(null);
      setFormNo(null);
      createM.reset();
      await find(no);
    },
    [createM, find],
  );

  const generate = useCallback(async () => {
    if (found === null) return;
    const r = await createM.run({ card: found.jobCard, phone });
    if (r.ok) setLink(r.value);
    else if (r.error.code === "CONFLICT") await lookup(found.jobCard.jobCardNo);
  }, [found, phone, createM, lookup]);

  const openForm = useCallback(
    (no: string) => {
      clear();
      setFormNo(no);
    },
    [clear],
  );

  const saved = useCallback(
    (card: JobCardView) => {
      setFormNo(null);
      show({ jobCard: card, current: null });
    },
    [show],
  );

  const closeForm = useCallback(() => {
    setFormNo(null);
  }, []);

  return { ...lk, formNo, openForm, closeForm, saved, link, setLink, lookup, generate, createM };
}
