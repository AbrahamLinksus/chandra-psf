import { env } from "@/config/env";

/** Contact details come from NEXT_PUBLIC_ keys via src/config/env.ts (D-37, SPEC §9). */
export const COMPANY_NAME = env.NEXT_PUBLIC_COMPANY_NAME;
export const HEAD_OFFICE_PHONE = env.NEXT_PUBLIC_PRIVACY_PHONE;
export const HEAD_OFFICE_EMAIL = env.NEXT_PUBLIC_PRIVACY_EMAIL;
