"use client";

import Link from "next/link";
import { LinkIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkCard } from "./LinkCard";
import { useMyLinks } from "./useMyLinks";

const noop = () => undefined;

export function MyLinksScreen() {
  const { search, setSearch, data, error, isLoading } = useMyLinks();
  const searching = search.trim() !== "";
  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">My feedback links</h1>
        <Button asChild className="h-12">
          <Link href="/support/new">
            <PlusIcon aria-hidden /> New feedback link
          </Link>
        </Button>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="link-search">Search by job card or reg. no</Label>
        <Input
          id="link-search"
          className="h-12"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
      </div>
      {isLoading && <PageSkeleton />}
      {error !== undefined && (
        <p role="alert" className="text-danger">
          {error.message}
        </p>
      )}
      {data?.length === 0 && (
        <EmptyState
          icon={LinkIcon}
          title={searching ? "No links match your search" : "No links yet"}
          hint={
            searching ? "Try another job card or reg. no." : "Create one with New feedback link."
          }
        />
      )}
      <ul className="grid gap-3">
        {data?.map((v) => (
          <LinkCard key={v.id} visit={v} sendLabel="Resend" onUpdated={noop} />
        ))}
      </ul>
    </main>
  );
}
