import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AlertView } from "@/data/access/repos/alerts";
import { formatIST } from "@/domain/time";
import { AlertEditor } from "./AlertEditor";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Notes({ alert }: { alert: AlertView }) {
  if (alert.notes.length === 0) return null;
  return (
    <ul className="grid gap-2" aria-label="Notes">
      {alert.notes.map((n) => (
        <li key={n.at} className="rounded-lg bg-secondary p-2 text-sm">
          <p>{n.text}</p>
          <p className="text-xs text-muted-foreground">
            {n.by} · {formatIST(n.at)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AlertDrawer({
  alert,
  onClose,
}: {
  alert: AlertView | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={alert !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="overflow-y-auto">
        {alert && (
          <>
            <SheetHeader>
              <SheetTitle>{alert.customerName}</SheetTitle>
              <SheetDescription>{alert.reasonsText}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-4">
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Phone" value={alert.phone ?? "No phone"} />
                <Field label="Vehicle" value={`${alert.model} · ${alert.regNo}`} />
              </dl>
              <Link
                href={`/admin/responses/${alert.responseId}`}
                className="text-brand flex h-12 items-center font-medium underline"
              >
                View response
              </Link>
              <Notes alert={alert} />
              <AlertEditor key={alert.id} alert={alert} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
