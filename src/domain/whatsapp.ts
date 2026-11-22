import { toWhatsAppNumber } from "./phone";

export interface WhatsAppContext {
  name: string;
  model: string;
  regNo: string;
  url: string;
}

/** SPEC section 5 template as a `wa.me` link; null when the phone is not a mobile number. */
export function buildWhatsAppUrl(phone: string | null, ctx: WhatsAppContext): string | null {
  const number = toWhatsAppNumber(phone);
  if (number === null) return null;
  const text =
    `Hi ${ctx.name}, thank you for servicing your ${ctx.model} (${ctx.regNo}) at Chandra Honda. ` +
    `Please share your feedback (2 mins): ${ctx.url}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
