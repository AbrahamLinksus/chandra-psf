"use client";

import { useState } from "react";
import { useDataAccess } from "@/data/access/provider";
import type { CustomerRow } from "@/data/access/repos/customers";

function message(e: { code: string; message: string }): string {
  return e.code === "FORBIDDEN" ? "Not allowed" : e.message;
}

function query(text: string): { phone: string } | { regNo: string } {
  return /[a-z]/i.test(text) ? { regNo: text.trim() } : { phone: text.trim() };
}

function saveCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Search customers by phone or reg. no across branches, tick job cards and download their CSV. */
export function useCustomerSearch() {
  const da = useDataAccess();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>();
  const [ticked, setTicked] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setError(undefined);
    const res = await da.customers.searchCustomers(query(text));
    setBusy(false);
    setTicked([]);
    if (!res.ok) {
      setRows(undefined);
      setError(message(res.error));
      return;
    }
    setRows(res.value);
  };

  const toggle = (id: string) => {
    setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  };

  const download = async () => {
    setBusy(true);
    setError(undefined);
    const res = await da.customers.exportCustomers(ticked);
    setBusy(false);
    if (!res.ok) {
      setError(message(res.error));
      return;
    }
    saveCsv(res.value.filename, res.value.csv);
  };

  return { text, setText, rows, ticked, toggle, error, busy, search, download };
}
