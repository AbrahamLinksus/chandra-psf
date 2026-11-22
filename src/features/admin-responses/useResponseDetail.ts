"use client";

import { useRepoQuery } from "@/hooks/useRepoQuery";

/** One live response with its visit, job card, questionnaire and alert. */
export function useResponseDetail(id: string) {
  return useRepoQuery(["responses", "detail", id], (da) => da.responses.getResponse(id));
}
