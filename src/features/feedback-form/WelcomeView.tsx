import { Button } from "@/components/ui/button";
import { formatISTDate } from "@/domain/time";

export interface WelcomeViewProps {
  customerName: string;
  model: string;
  serviceDate: string;
  onStart: () => void;
}

export function WelcomeView({ customerName, model, serviceDate, onStart }: WelcomeViewProps) {
  return (
    <section className="flex flex-1 flex-col justify-center gap-6 py-10 text-center">
      <h1 className="text-2xl leading-snug font-semibold">
        Hi {customerName}, how was your {model}&apos;s service on {formatISTDate(serviceDate)}?
      </h1>
      <p className="text-muted-foreground">Takes about 2 minutes</p>
      <Button type="button" size="lg" className="h-14 w-full text-lg" onClick={onStart}>
        Start
      </Button>
    </section>
  );
}
