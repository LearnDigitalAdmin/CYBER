import { DeskError } from "../errors.js";

/** Any common Kenyan format -> +2547XXXXXXXX / +2541XXXXXXXX. Throws on anything else. */
export function normalizeKenyaPhone(raw: string): string {
  let p = raw.replace(/[\s()-]/g, "");
  if (p.startsWith("+254")) p = p.slice(1);
  else if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (/^[17]\d{8}$/.test(p)) p = "254" + p;
  if (!/^254[17]\d{8}$/.test(p)) throw new DeskError("invalid_argument", "Enter a valid Kenyan phone number");
  return "+" + p;
}
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 5)}•• ••• ${e164.slice(-3)}`;
}
