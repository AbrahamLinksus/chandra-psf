import { CheckIcon } from "lucide-react";

export function ThankYouView({ callbackRequested }: { callbackRequested: boolean }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <span
        data-testid="success-animation"
        className="flex size-24 animate-in items-center justify-center rounded-full bg-primary text-primary-foreground duration-500 zoom-in-50 fade-in"
      >
        <CheckIcon className="size-12" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">Thank you for your feedback</h1>
      {callbackRequested && (
        <p className="text-lg text-muted-foreground">Our team will call you soon</p>
      )}
    </section>
  );
}
