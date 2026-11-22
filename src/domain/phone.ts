const MOBILE_LENGTH = 10;
const COUNTRY_CODE = "91";
const MOBILE_START = /^[6-9]/;

/** WhatsApp number (`91` + 10 digits) or null for a landline or blank phone (S-03). */
export function toWhatsAppNumber(phone: string | null): string | null {
  if (phone === null) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === MOBILE_LENGTH && MOBILE_START.test(digits)) return COUNTRY_CODE + digits;
  const national = digits.slice(COUNTRY_CODE.length);
  if (
    digits.startsWith(COUNTRY_CODE) &&
    national.length === MOBILE_LENGTH &&
    MOBILE_START.test(national)
  ) {
    return digits;
  }
  return null;
}
