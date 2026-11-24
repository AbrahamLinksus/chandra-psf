"use client";

import { useState } from "react";
import { useRepoQuery } from "@/hooks/useRepoQuery";

export type LinkScope = "mine" | "branch";

export function useMyLinks() {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<LinkScope>("mine");
  const query = useRepoQuery(["visits", scope, search], (da) =>
    da.visits.listVisits({ scope, search }),
  );
  return { search, setSearch, scope, setScope, ...query };
}
