import { toWhatsAppNumber } from "./phone";

export interface WhatsAppContext {
  name: string;
  model: string;
  regNo: string;
  url: string;
}

/** The owner's WhatsApp message (2026-11-26), with the feedback link on its own line. */
export function whatsAppMessage(url: string): string {
  return [
    "Dear Customer,",
    "Thank you for choosing Chandra Honda for servicing your two-wheeler.",
    "We value your feedback! Kindly click the link below to complete a short survey within 24 hours of vehicle delivery and help us serve you better.",
    url,
    "Thank you for your time and trust!",
  ].join("\n");
}

/** The message as a `wa.me` link; null when the phone is not a mobile number. */
export function buildWhatsAppUrl(phone: string | null, ctx: WhatsAppContext): string | null {
  const number = toWhatsAppNumber(phone);
  if (number === null) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(whatsAppMessage(ctx.url))}`;
}
