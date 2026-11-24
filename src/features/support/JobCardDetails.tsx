import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JobCardView } from "@/data/access/repos/jobCards";
import { formatMobile } from "@/domain/jobCardInput";
import { toWhatsAppNumber } from "@/domain/phone";
import { formatISTDate } from "@/domain/time";
import { FEEDBACK_RECEIVED, NEEDS_MOBILE } from "./messages";

interface Props {
  card: JobCardView;
  phone: string;
  onPhone: (v: string) => void;
  phoneEditable: boolean;
}

/** Job card summary with the phone still editable before the link is sent (S-03). */
export function JobCardDetails({ card, phone, onPhone, phoneEditable }: Props) {
  const vehicle = card.vehicleType === "scooter" ? "Scooter" : "Motorcycle";
  const mobile = formatMobile(card.phone ?? "") ?? card.phone ?? "No mobile";
  const editable = phoneEditable && card.editable;
  return (
    <section
      aria-label="Job card details"
      className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">{card.customerName}</h2>
        <p className="text-sm" data-testid="card-summary">
          {mobile} · {card.regNo} · {vehicle} · Advisor: {card.advisorName}
        </p>
        <p className="text-sm text-muted-foreground">
          {card.jobCardNo} · {card.model} · {card.serviceType} ·{" "}
          {formatISTDate(card.serviceDate, { year: true })}
        </p>
      </div>
      {!card.editable && (
        <p role="status" className="text-sm text-muted-foreground">
          {FEEDBACK_RECEIVED}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="customer-phone">Phone</Label>
        <Input
          id="customer-phone"
          type="tel"
          inputMode="tel"
          className="h-12"
          value={phone}
          disabled={!editable}
          onChange={(e) => {
            onPhone(e.target.value);
          }}
        />
        {editable && toWhatsAppNumber(phone) === null && (
          <p className="text-sm text-muted-foreground">{NEEDS_MOBILE}</p>
        )}
      </div>
    </section>
  );
}
