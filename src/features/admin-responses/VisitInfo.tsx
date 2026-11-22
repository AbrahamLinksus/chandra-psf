import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ResponseDetail } from "@/data/access/repos/responses";
import { formatReasons } from "@/domain/alertRules";
import { formatIST, formatISTDate } from "@/domain/time";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

export function VisitInfo({ detail }: { detail: ResponseDetail }) {
  const { jobCard: c, visit, response, alert } = detail;
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Customer" value={c.customerName} />
        <Field label="Job card" value={c.jobCardNo} />
        <Field label="Registration" value={c.regNo} />
        <Field label="Vehicle" value={`${c.model} (${c.vehicleType})`} />
        <Field label="Service date" value={formatISTDate(c.serviceDate, { year: true })} />
        <Field label="Advisor" value={c.advisorName} />
        <Field label="Phone" value={visit.phone ?? "—"} />
        <Field label="Submitted" value={formatIST(response.submittedAt)} />
      </dl>
      {alert !== null && (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="response-alert">
          <StatusBadge kind={alert.status} /> {formatReasons(alert.reasons)}
        </p>
      )}
    </div>
  );
}
