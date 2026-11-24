"use client";

import Link from "next/link";
import { LinkIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LinkCard } from "./LinkCard";
import { useMyLinks } from "./useMyLinks";

const noop = () => undefined;

const TITLES = { mine: "My feedback links", branch: "All branch links" } as const;

export function MyLinksScreen() {
  const { search, setSearch, scope, setScope, data, error, isLoading } = useMyLinks();
  const searching = search.trim() !== "";
  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{TITLES[scope]}</h1>
        <Button asChild className="h-12">
          <Link href="/support/new">
            <PlusIcon aria-hidden /> New feedback link
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="link-scope"
          checked={scope === "branch"}
          onCheckedChange={(on) => {
            setScope(on ? "branch" : "mine");
          }}
        />
        <Label htmlFor="link-scope">All branch links</Label>
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
          title={searching ? "No links match your search" : "No feedback links yet."}
          hint={searching ? "Try another job card or reg. no." : "Tap New feedback link to start."}
        />
      )}
      <ul className="grid gap-3">
        {data?.map((v) => (
          <LinkCard key={v.id} visit={v} showCreator={scope === "branch"} onCancelled={noop} />
        ))}
      </ul>
    </main>
  );
}
