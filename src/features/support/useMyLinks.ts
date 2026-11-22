"use client";

import { useState } from "react";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export function useMyLinks() {
  const [search, setSearch] = useState("");
  const query = useRepoQuery(["visits", "mine", search], (da) =>
    da.visits.listMyVisits({ search }),
  );
  return { search, setSearch, ...query };
}
