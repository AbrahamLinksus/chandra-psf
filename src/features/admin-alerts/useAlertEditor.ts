"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AlertView } from "@/data/access/repos/alerts";
import type { AlertStatus } from "@/domain/types";
import { useRepoMutation } from "@/hooks/useRepoMutation";

interface SaveInput {
  id: string;
  status?: AlertStatus;
  note?: string;
  version: number;
}

/** Draft status + note for one alert; the note stays typed when a save fails (S-13). */
export function useAlertEditor(alert: AlertView) {
  const [status, setStatus] = useState<AlertStatus>(alert.status);
  const [note, setNote] = useState("");
  const mutation = useRepoMutation((da, input: SaveInput) =>
    da.alerts.updateAlert(
      input.id,
      {
        ...(input.status ? { status: input.status } : {}),
        ...(input.note ? { note: input.note } : {}),
      },
      input.version,
    ),
  );
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["alerts"] });
  const conflict = mutation.error?.code === "CONFLICT";
  const trimmed = note.trim();
  const changed = status !== alert.status || trimmed !== "";

  const save = async () => {
    const result = await mutation.run({
      id: alert.id,
      version: alert.version,
      ...(status !== alert.status ? { status } : {}),
      ...(trimmed !== "" ? { note: trimmed } : {}),
    });
    if (result.ok) {
      setNote("");
      void refresh();
    }
  };

  /** After a CONFLICT: refetch so the next save carries the new version; the note stays. */
  const reload = async () => {
    await refresh();
    mutation.reset();
  };

  return { status, setStatus, note, setNote, changed, save, mutation, conflict, reload };
}
