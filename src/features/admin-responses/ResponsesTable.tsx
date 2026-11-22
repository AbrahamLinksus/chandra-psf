"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ResponseListRow } from "@/data/access/repos/responses";
import { formatISTDate } from "@/domain/time";

function Row({ row }: { row: ResponseListRow }) {
  const router = useRouter();
  const href = `/admin/responses/${row.id}`;
  return (
    <TableRow
      className="cursor-pointer"
      data-response-id={row.id}
      onClick={() => {
        router.push(href);
      }}
    >
      <TableCell>{formatISTDate(row.serviceDate, { year: true })}</TableCell>
      <TableCell className="max-w-40 truncate" title={row.customerName}>
        <Link
          href={href}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="inline-flex min-h-12 items-center font-medium underline"
        >
          {row.customerName}
        </Link>
      </TableCell>
      <TableCell className="max-w-32 truncate" title={row.model}>
        {row.model}
      </TableCell>
      <TableCell className="max-w-32 truncate" title={row.advisorName}>
        {row.advisorName}
      </TableCell>
      <TableCell>{row.q12} / 5</TableCell>
      <TableCell>{row.hasAlert && <Badge variant="destructive">Alert</Badge>}</TableCell>
    </TableRow>
  );
}

export function ResponsesTable({ rows }: { rows: ResponseListRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Advisor</TableHead>
            <TableHead>Overall</TableHead>
            <TableHead>Alert</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
