import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toWhatsAppNumber } from "@/domain/phone";
import { formatISTDate } from "@/domain/time";
import { NEEDS_MOBILE } from "./LinkActions";
import type { FoundCard } from "./useNewLink";

interface Props {
  card: FoundCard["jobCard"];
  phone: string;
  onPhone: (v: string) => void;
  phoneEditable: boolean;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function JobCardDetails({ card, phone, onPhone, phoneEditable }: Props) {
  const vehicle = card.vehicleType === "scooter" ? "Scooter" : "Motorcycle";
  return (
    <section
      aria-label="Job card details"
      className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <dl className="grid grid-cols-2 gap-3">
        <Row label="Customer" value={card.customerName} />
        <Row label="Reg. no." value={card.regNo} />
        <Row label="Model" value={card.model} />
        <Row label="Vehicle type" value={vehicle} />
        <Row label="Service type" value={card.serviceType} />
        <Row label="Service date" value={formatISTDate(card.serviceDate)} />
        <Row label="Advisor" value={card.advisorName} />
      </dl>
      <div className="grid gap-1.5">
        <Label htmlFor="customer-phone">Phone</Label>
        <Input
          id="customer-phone"
          type="tel"
          className="h-12"
          value={phone}
          disabled={!phoneEditable}
          onChange={(e) => {
            onPhone(e.target.value);
          }}
        />
        {phoneEditable && toWhatsAppNumber(phone) === null && (
          <p className="text-sm text-muted-foreground">{NEEDS_MOBILE}</p>
        )}
      </div>
    </section>
  );
}
