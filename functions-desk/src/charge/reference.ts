import { DESK_REF_PREFIX } from "../contract.js";

/** CYBER_DSK_<ticketId>_<attempt>. Ticket ids are Firestore auto ids (alphanumeric), so the last `_` always separates the attempt. */
export const buildDeskReference = (ticketId: string, attempt: number): string => `${DESK_REF_PREFIX}${ticketId}_${attempt}`;

const REF = new RegExp(`^${DESK_REF_PREFIX}([A-Za-z0-9]{1,128})_(\\d{1,3})$`);
export function parseDeskReference(reference: string): { ticketId: string; attempt: number } | undefined {
  const m = REF.exec(reference);
  if (!m) return undefined;
  const attempt = Number(m[2]);
  return attempt >= 1 ? { ticketId: m[1], attempt } : undefined;
}
