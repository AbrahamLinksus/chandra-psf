"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAuditValue, needsTruncation, truncate } from "./auditFormat";

/** One old/new value; long text is cut with a "Show more" toggle. */
export function AuditValue({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const text = formatAuditValue(value);
  const long = needsTruncation(text);
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm break-words" data-testid="audit-value">
        {open ? text : truncate(text)}
      </p>
      {long && (
        <Button
          type="button"
          variant="link"
          className="h-12 px-0"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          {open ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
