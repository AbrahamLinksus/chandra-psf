import { SaveState } from "@/components/shared/SaveState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { FeedbackFlow } from "./useFeedbackFlow";
import { LAST_STEP, stepLabel } from "./formMachine";
import { StepView } from "./StepView";

export function StepScreen({ flow }: { flow: FeedbackFlow }) {
  const { step, answers } = flow.state;
  const saving = flow.submitStatus === "saving";
  return (
    <>
      <header className="space-y-2 py-4">
        <p className="text-sm font-medium text-muted-foreground">{stepLabel(step)}</p>
        <Progress value={(step / LAST_STEP) * 100} aria-label={stepLabel(step)} />
      </header>
      <div className="flex-1 pb-6">
        <StepView step={step} answers={answers} onAnswer={flow.answer} />
      </div>
      <footer className="sticky bottom-0 -mx-4 space-y-2 border-t bg-background px-4 py-3">
        <SaveState status={flow.submitStatus} error={flow.submitError} onRetry={flow.submit} />
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            disabled={saving}
            onClick={flow.back}
          >
            Back
          </Button>
          <Button
            type="button"
            className="h-12 flex-[2]"
            disabled={!flow.nextEnabled || saving}
            onClick={flow.lastStep ? flow.submit : flow.next}
          >
            {flow.lastStep ? "Submit" : "Next"}
          </Button>
        </div>
      </footer>
    </>
  );
}
