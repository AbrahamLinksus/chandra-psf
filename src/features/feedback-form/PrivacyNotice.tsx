import Link from "next/link";
import { COMPANY_NAME, HEAD_OFFICE_PHONE } from "./contact";

/** The short DPDP notice shown on the welcome screen (SPEC §9, G-12). */
export function PrivacyNotice() {
  return (
    <aside
      aria-label="Privacy notice"
      className="space-y-2 rounded-lg border bg-card p-4 text-left text-sm text-muted-foreground"
    >
      <p>
        {COMPANY_NAME} (Chandra Honda) collects your answers, linked to your name, mobile number and
        vehicle, to improve our service and to call you back if you ask. Only our service managers
        see them. We keep them for 3 years. Our hosting providers may store them outside India. To
        see or delete your data, call {HEAD_OFFICE_PHONE}.
      </p>
      <Link href="/privacy" className="font-medium text-primary underline underline-offset-2">
        How we use your answers
      </Link>
    </aside>
  );
}
