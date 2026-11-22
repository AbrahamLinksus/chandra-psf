"use client";

import { useState } from "react";
import type { AlertView } from "@/data/access/repos/alerts";
import type { AlertStatus } from "@/domain/types";
import { useRepoMutation } from "@/hooks/useRepoMutation";

interface SaveInput {
  id: string;
  status?: AlertStatus;
  note?: string;
}

/** Draft status + note for one alert; the note stays typed when a save fails (S-13). */
export function useAlertEditor(alert: AlertView) {
  const [status, setStatus] = useState<AlertStatus>(alert.status);
  const [note, setNote] = useState("");
  const mutation = useRepoMutation((da, input: SaveInput) =>
    da.alerts.updateAlert(input.id, {
      ...(input.status ? { status: input.status } : {}),
      ...(input.note ? { note: input.note } : {}),
    }),
  );
  const trimmed = note.trim();
  const changed = status !== alert.status || trimmed !== "";

  const save = async () => {
    const result = await mutation.run({
      id: alert.id,
      ...(status !== alert.status ? { status } : {}),
      ...(trimmed !== "" ? { note: trimmed } : {}),
    });
    if (result.ok) setNote("");
  };

  return { status, setStatus, note, setNote, changed, save, mutation };
}
