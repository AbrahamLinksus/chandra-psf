"use client";

import type { SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onLookup: () => void;
  looking: boolean;
  error: string | null;
}

/** Job card number box with its Look up button and error line. */
export function LookupBar({ value, onChange, onLookup, looking, error }: Props) {
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    onLookup();
  };
  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label htmlFor="job-card-no">Job card number</Label>
      <div className="flex gap-2">
        <Input
          id="job-card-no"
          className="h-12"
          value={value}
          placeholder="JC-24-1042"
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
        <Button type="submit" className="h-12" disabled={looking}>
          {looking ? "Looking up…" : "Look up"}
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
