"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { DEFAULT_RANGE_DAYS } from "@/domain/constants";
import { addDays, istDateOf } from "@/domain/time";
import type { Filters, JobCard } from "@/domain/types";

const VEHICLE_TYPES: JobCard["vehicleType"][] = ["scooter", "motorcycle"];

function vehicleTypeOf(raw: string | null): JobCard["vehicleType"] | undefined {
  return VEHICLE_TYPES.find((t) => t === raw);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valid only if the calendar date round-trips (rejects 2026-13-45, 2026-02-30). */
export function dateOf(raw: string | null): string | null {
  if (raw === null || !ISO_DATE.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? null : raw;
}

/**
 * Filters live in the URL query; default range is the last DEFAULT_RANGE_DAYS days.
 * Malformed dates fall back to the default. Consumers need a <Suspense> boundary (useSearchParams).
 */
export function useFiltersFromUrl(): { filters: Filters; setFilters(next: Filters): void } {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();

  const filters = useMemo<Filters>(() => {
    const p = new URLSearchParams(query);
    const to = dateOf(p.get("to")) ?? istDateOf(new Date());
    const base: Filters = { from: dateOf(p.get("from")) ?? addDays(to, -DEFAULT_RANGE_DAYS), to };
    const vehicleType = vehicleTypeOf(p.get("vehicleType"));
    const model = p.get("model");
    const advisorId = p.get("advisorId");
    return {
      ...base,
      ...(vehicleType ? { vehicleType } : {}),
      ...(model ? { model } : {}),
      ...(advisorId ? { advisorId } : {}),
    };
  }, [query]);

  const setFilters = useCallback(
    (next: Filters) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) if (typeof v === "string" && v !== "") p.set(k, v);
      router.replace(`${pathname}?${p.toString()}`);
    },
    [router, pathname],
  );

  return { filters, setFilters };
}
