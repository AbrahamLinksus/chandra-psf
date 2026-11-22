"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DetailActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="h-12" onClick={onEdit}>
        <PencilIcon aria-hidden /> Edit
      </Button>
      <Button type="button" variant="outline" className="h-12 text-danger" onClick={onDelete}>
        <Trash2Icon aria-hidden /> Delete
      </Button>
    </div>
  );
}

interface EditBarProps {
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function EditBar({ canSave, onSave, onCancel }: EditBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="h-12" disabled={!canSave} onClick={onSave}>
        Save changes
      </Button>
      <Button type="button" variant="outline" className="h-12" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
