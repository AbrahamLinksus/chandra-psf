import { COMPANY_NAME, HEAD_OFFICE_EMAIL, HEAD_OFFICE_PHONE } from "./contact";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What we collect",
    body: "Your answers to the service feedback questions, linked to your name, mobile number and vehicle from your job card. We do not collect your email, address or ID numbers.",
  },
  {
    title: "Why we collect it",
    body: "Only to improve our service and to call you back if you ask us to. We do not use it for anything else and do not share it with anyone other than the hosting and database providers that store it.",
  },
  {
    title: "Who sees it",
    body: "Only our service managers and head-office team.",
  },
  {
    title: "How long we keep it",
    body: "3 years, after which it is deleted.",
  },
  {
    title: "Where it is stored",
    body: "Our hosting providers may store your answers outside India.",
  },
  {
    title: "Your choices",
    body: "Answering is optional: you can close the page at any time. Tapping Start means you agree to us using your answers as described here. You can ask to see or delete your data at any time.",
  },
];

export function PrivacyScreen() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">How we use your answers</h1>
      <p className="text-muted-foreground">
        {COMPANY_NAME} (Chandra Honda) asks for your feedback after a service visit. This is how we
        handle what you tell us.
      </p>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-1">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <p>{s.body}</p>
        </section>
      ))}
      <section className="space-y-1">
        <h2 className="text-lg font-semibold">Contact us</h2>
        <p>
          To see or delete your data, call {HEAD_OFFICE_PHONE} or email {HEAD_OFFICE_EMAIL}.
        </p>
      </section>
    </main>
  );
}
