import type { FormContext } from "@/data/access/repos/feedback";
import { LinkStateScreen } from "./LinkStateScreen";
import { StepScreen } from "./StepScreen";
import { ThankYouView } from "./ThankYouView";
import { useFeedbackFlow } from "./useFeedbackFlow";
import { WelcomeView } from "./WelcomeView";

type Ready = Extract<FormContext, { state: "ready" }>;

export function FeedbackFlowScreen({ token, context }: { token: string; context: Ready }) {
  const flow = useFeedbackFlow(token, context.visitId);
  if (flow.ended !== null) return <LinkStateScreen state={flow.ended} />;
  switch (flow.state.phase) {
    case "welcome":
      return (
        <WelcomeView
          customerName={context.customerName}
          model={context.model}
          serviceDate={context.serviceDate}
          onStart={flow.start}
        />
      );
    case "thanks":
      return <ThankYouView callbackRequested={flow.state.callbackRequested} />;
    case "step":
      return <StepScreen flow={flow} />;
  }
}
