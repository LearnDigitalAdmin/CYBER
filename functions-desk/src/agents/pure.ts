import { createHash } from "node:crypto";
import { DESK_CODE_PREFIX } from "../contract.js";
import { DeskError } from "../errors.js";
import { normalizeKenyaPhone } from "../paystack/phone.js";
import { record, text } from "../connectors/input.js";

export interface ApplicationFields { name: string; phone: string; idNumber: string; wardId: string }

/** Validates and normalises an application. Phone becomes +254…; ID number is digits only. Pure. */
export function validateApplication(raw: unknown): ApplicationFields {
  const d = record(raw);
  const name = text(d.name, "Name", 2, 80);
  const wardId = text(d.wardId, "Ward", 1, 40);
  const phone = normalizeKenyaPhone(typeof d.phone === "string" ? d.phone : "");
  const idNumber = typeof d.idNumber === "string" ? d.idNumber.replace(/\s+/g, "") : "";
  if (!/^\d{6,12}$/.test(idNumber)) throw new DeskError("invalid_argument", "ID number must be 6–12 digits");
  return { name, phone, idNumber, wardId };
}

/** COG-0001, COG-0002 … at least 4 digits. COG-0000 is the company's top desk and is never issued. */
export function formatAgentCode(n: number): string {
  if (!Number.isSafeInteger(n) || n < 1) throw new DeskError("internal", "Invalid desk number");
  return `${DESK_CODE_PREFIX}${String(n).padStart(4, "0")}`;
}

/** Next number from the stored counter: the counter holds the LAST issued number, so a fresh or damaged one yields 1. */
export function nextCounterValue(stored: unknown): number {
  const n = typeof stored === "number" && Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
  return n + 1;
}

/** Salted SHA-256 of the ID number. Never store the number itself. */
export const hashIdNumber = (idNumber: string, salt: string): string =>
  createHash("sha256").update(`${salt}:${idNumber}`).digest("hex");

export const maskIdNumber = (idNumber: string): string => `****${idNumber.slice(-4)}`;
