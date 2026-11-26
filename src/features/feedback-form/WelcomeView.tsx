import { Button } from "@/components/ui/button";
import { PrivacyNotice } from "./PrivacyNotice";

export interface WelcomeViewProps {
  customerName: string;
  model: string;
  serviceDate: string;
  onStart: () => void;
}

/** The owner's welcome text (2026-11-26); the card details stay in the props for later use. */
export function WelcomeView({ onStart }: WelcomeViewProps) {
  return (
    <section className="flex flex-1 flex-col justify-center gap-6 py-10 text-center">
      <h1 className="text-2xl leading-snug font-semibold">Dear Customer,</h1>
      <div className="space-y-3 text-lg leading-relaxed">
        <p>
          Thank you for choosing Chandra Honda for servicing your two-wheeler. Your peace of mind is
          our priority!
        </p>
        <p>Kindly share your feedback and help us ensure a worry-free riding experience.</p>
      </div>
      <p className="text-muted-foreground">Takes about 2 minutes</p>
      <PrivacyNotice />
      <Button type="button" size="lg" className="h-14 w-full text-lg" onClick={onStart}>
        Start
      </Button>
    </section>
  );
}
