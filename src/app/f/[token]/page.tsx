import { FeedbackFormScreen } from "@/features/feedback-form/FeedbackFormScreen";

export default async function FeedbackFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FeedbackFormScreen token={token} />;
}
