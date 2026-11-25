"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ResponseDetail } from "@/data/access/repos/responses";
import type { AnswerMap, AnswerValue, QuestionCode } from "@/domain/types";
import { pruneHidden, validateSubmission } from "@/domain/visibility";
import { useRepoMutation } from "@/hooks/useRepoMutation";

interface EditInput {
  answers: AnswerMap;
  password: string;
}

/** Saves an edit; on success the detail shows the saved answers and new version, and lists refetch. */
function useEditMutation(id: string, version: number) {
  const queryClient = useQueryClient();
  return useRepoMutation(async (da, i: EditInput) => {
    const result = await da.responses.editResponse(id, i.answers, version, {
      password: i.password,
    });
    if (result.ok) {
      queryClient.setQueryData(["responses", "detail", id], result);
      void queryClient.invalidateQueries({ queryKey: ["responses"] });
    }
    return result;
  });
}

/** Draft answers for an edit; they stay in place when a save fails (S-13). */
export function useResponseEditor(detail: ResponseDetail) {
  const { id, answers: saved } = detail.response,
    { version } = detail;
  const [draft, setDraft] = useState<AnswerMap | null>(null);
  const [askPassword, setAskPassword] = useState(false);
  const mutation = useEditMutation(id, version);

  const start = () => {
    mutation.reset();
    setDraft({ ...saved });
  };
  const cancel = () => {
    mutation.reset();
    setDraft(null);
    setAskPassword(false);
  };
  const setAnswer = (code: QuestionCode, value: AnswerValue) => {
    setDraft((d) => (d === null ? d : { ...d, [code]: value }));
  };
  const save = async (password: string) => {
    const result = await mutation.run({ answers: draft ?? saved, password });
    if (result.ok) setDraft(null);
    return result;
  };

  const changed =
    draft !== null && JSON.stringify(pruneHidden(draft)) !== JSON.stringify(pruneHidden(saved));
  const valid = draft !== null && validateSubmission(draft).ok;
  return {
    draft,
    start,
    cancel,
    setAnswer,
    save,
    mutation,
    changed,
    valid,
    askPassword,
    setAskPassword,
  };
}
