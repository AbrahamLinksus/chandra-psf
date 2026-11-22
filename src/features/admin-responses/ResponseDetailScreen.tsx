"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ResponseDetailView } from "./ResponseDetailView";
import { useResponseDetail } from "./useResponseDetail";

function Body({ id }: { id: string }) {
  const { data, error, isLoading } = useResponseDetail(id);
  if (error !== undefined) {
    return (
      <p role="alert" className="text-danger">
        {error.code === "NOT_FOUND" ? "Response not found" : error.message}
      </p>
    );
  }
  if (isLoading || data === undefined) return <PageSkeleton />;
  return <ResponseDetailView detail={data} />;
}

export function ResponseDetailScreen({ id }: { id: string }) {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <Link href="/admin/responses" className="inline-flex min-h-12 items-center gap-2 underline">
        <ArrowLeftIcon className="size-4" aria-hidden /> Responses
      </Link>
      <h1 className="text-2xl font-semibold">Response</h1>
      <Body id={id} />
    </main>
  );
}
