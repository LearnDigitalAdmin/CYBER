/** Mirrors functions-desk/src/paystack/phone.ts so the UI rejects bad numbers before a round trip. The server re-validates. */

/** Every current Safaricom prefix (3 digits after the leading 0 / +254), inclusive. Same list as PAY safaricom.ts. */
const SAFARICOM_PREFIX_RANGES: ReadonlyArray<readonly [number, number]> = [
  [700, 729], [740, 743], [745, 746], [757, 759], [768, 769], [790, 799],
  [110, 115], [118, 119], [140, 143], [180, 182],
];
export const PHONE_MAX_INPUT_LENGTH = 17;
export const PHONE_EXAMPLE = "Enter a Safaricom number such as 0712 345 678 or 0110 123 456.";
export const NOT_SAFARICOM = "Only Safaricom numbers are supported (for example 0712 345 678 or 0110 123 456).";

/** Drops anything a phone number cannot contain, so pasted junk never reaches state. */
export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/[^\d\s+()-]/g, "").slice(0, PHONE_MAX_INPUT_LENGTH);
}

/** null when `raw` is a valid Safaricom number, else a message saying what to fix. */
export function phoneProblem(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return PHONE_EXAMPLE;
  if (t.length > PHONE_MAX_INPUT_LENGTH) return `That number is too long. ${PHONE_EXAMPLE}`;
  if (!/^\+?[\d\s()-]+$/.test(t)) return `Phone numbers can only contain digits (and a + at the start). ${PHONE_EXAMPLE}`;
  const digits = t.replace(/\D/g, "");
  if (!/^(?:254|0)?[17]\d{8}$/.test(digits)) {
    const expected = digits.startsWith("254") ? 12 : digits.startsWith("0") ? 10 : 9;
    if (digits.length < expected) return `That number is too short — a Safaricom number has 10 digits. ${PHONE_EXAMPLE}`;
    if (digits.length > expected) return `That number is too long — a Safaricom number has 10 digits. ${PHONE_EXAMPLE}`;
    return `That doesn't look like a Kenyan mobile number. ${PHONE_EXAMPLE}`;
  }
  const prefix = Number(digits.slice(-9, -6));
  return SAFARICOM_PREFIX_RANGES.some(([lo, hi]) => prefix >= lo && prefix <= hi) ? null : NOT_SAFARICOM;
}

/** Any common Safaricom spelling -> "+2547XXXXXXXX" / "+2541XXXXXXXX", or null when it is not a valid Safaricom number. */
export function normalizeKenyaPhone(raw: string): string | null {
  return phoneProblem(raw) ? null : "+254" + String(raw).replace(/\D/g, "").slice(-9);
}
