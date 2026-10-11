/** Mirrors functions-desk/src/paystack/phone.ts so the UI rejects bad numbers before a round trip. The server re-validates. */

/** Any common Kenyan format -> "+2547XXXXXXXX" / "+2541XXXXXXXX", or null when it is not a valid Kenyan mobile number. */
export function normalizeKenyaPhone(raw: string): string | null {
  let p = raw.replace(/[\s()-]/g, "");
  if (p.startsWith("+254")) p = p.slice(1);
  else if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (/^[17]\d{8}$/.test(p)) p = "254" + p;
  return /^254[17]\d{8}$/.test(p) ? "+" + p : null;
}
