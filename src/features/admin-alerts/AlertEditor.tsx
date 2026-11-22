import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AlertView } from "@/data/access/repos/alerts";
import type { AlertStatus } from "@/domain/types";
import { TEXT_MAX_LENGTH } from "@/domain/constants";
import { useAlertEditor } from "./useAlertEditor";

const STATUSES: { value: AlertStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "contacted", label: "Contacted" },
  { value: "resolved", label: "Resolved" },
];

/** Status buttons, note box and Save; mount with `key={alert.id}` so drafts reset per alert. */
export function AlertEditor({ alert }: { alert: AlertView }) {
  const { status, setStatus, note, setNote, changed, save, mutation } = useAlertEditor(alert);
  const saving = mutation.status === "saving";
  return (
    <div className="grid gap-4">
      <div role="group" aria-label="Set status" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s.value}
            type="button"
            variant={status === s.value ? "default" : "outline"}
            aria-pressed={status === s.value}
            className="h-12"
            onClick={() => {
              setStatus(s.value);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="alert-note">Add a note</Label>
        <Textarea
          id="alert-note"
          value={note}
          maxLength={TEXT_MAX_LENGTH}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
      </div>
      <SaveState status={mutation.status} error={mutation.error} onRetry={() => void save()} />
      <Button
        type="button"
        className="h-12"
        disabled={!changed || saving}
        onClick={() => void save()}
      >
        Save
      </Button>
    </div>
  );
}
