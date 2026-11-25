"use client";

import { useState } from "react";
import { useDataAccess } from "@/data/access/provider";

export function customerMessage(e: { code: string; message: string }): string {
  if (e.code === "BAD_PASSWORD") return "That password is not right";
  return e.code === "FORBIDDEN" ? "Not allowed" : e.message;
}

/** Confirm-with-password erase of the ticked job cards; refreshes the list afterwards. */
export function useEraseCustomers(ticked: string[], refresh: () => Promise<void>) {
  const da = useDataAccess();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  const open = () => {
    setError(undefined);
    setConfirming(true);
  };
  const close = () => {
    setConfirming(false);
  };
  const erase = async (password: string) => {
    setBusy(true);
    setError(undefined);
    const res = await da.customers.eraseCustomers(ticked, { password });
    setBusy(false);
    if (!res.ok) {
      setError(customerMessage(res.error));
      return;
    }
    setConfirming(false);
    setNotice(
      res.value.erased === 1 ? "Erased customer" : `Erased ${String(res.value.erased)} customers`,
    );
    await refresh();
  };
  return { confirming, open, close, erase, error, notice, busy };
}
