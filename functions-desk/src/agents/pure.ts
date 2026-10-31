import { createHash } from "node:crypto";
import { DESK_CODE_PREFIX } from "../contract.js";
import { DeskError } from "../errors.js";
import { normalizeKenyaPhone } from "../paystack/phone.js";
import { record, text } from "../connectors/input.js";
import { isInviteCode, resolveGeo } from "../network/pure.js";

export interface ApplicationFields {
  name: string; phone: string; idNumber: string; wardId: string;
  countyId?: string; constituencyId?: string;
  uplineCode?: string; inviteCode?: string; role?: "clerk" | "senior" | "lead";
}

const DESK_CODE = /^COG-\d{4,}$/;
const optionalText = (v: unknown, label: string, max: number): string | undefined => (v === undefined || v === null || v === "" ? undefined : text(v, label, 1, max));

/**
 * Validates and normalises an application. Phone must be Safaricom and becomes +254…; ID number is digits only.
 * Location: either the county + constituency + ward names from the address pickers (checked against the real Kenya list and turned into
 * ids) or, for the legacy form, a free ward label. Pure.
 */
export function validateApplication(raw: unknown): ApplicationFields {
  const d = record(raw);
  const name = text(d.name, "Name", 2, 80);
  const phone = normalizeKenyaPhone(typeof d.phone === "string" ? d.phone : "");
  const idNumber = typeof d.idNumber === "string" ? d.idNumber.replace(/\s+/g, "") : "";
  if (!/^\d{6,12}$/.test(idNumber)) throw new DeskError("invalid_argument", "ID number must be 6–12 digits");

  const county = optionalText(d.county, "County", 60), constituency = optionalText(d.constituency, "Constituency", 60), ward = optionalText(d.ward, "Ward", 60);
  let wardId: string; let countyId: string | undefined; let constituencyId: string | undefined;
  if (county || constituency || ward) {
    if (!county || !constituency || !ward) throw new DeskError("invalid_argument", "Choose your county, constituency and ward");
    const g = resolveGeo(county, constituency, ward);
    wardId = g.wardId; countyId = g.countyId; constituencyId = g.constituencyId;
  } else wardId = text(d.wardId, "Ward", 1, 40);

  const out: ApplicationFields = { name, phone, idNumber, wardId };
  if (countyId) { out.countyId = countyId; out.constituencyId = constituencyId; }
  const upline = optionalText(d.uplineCode, "Agent code", 20)?.toUpperCase();
  if (upline) { if (!DESK_CODE.test(upline)) throw new DeskError("invalid_argument", "That agent code is not valid. It looks like COG-0123."); out.uplineCode = upline; }
  const invite = optionalText(d.inviteCode, "Invite code", 12)?.toUpperCase();
  if (invite) { if (!isInviteCode(invite)) throw new DeskError("invalid_argument", "That invite code is not valid"); out.inviteCode = invite; }
  if (d.role !== undefined && d.role !== null && d.role !== "") {
    if (d.role !== "clerk" && d.role !== "senior" && d.role !== "lead") throw new DeskError("invalid_argument", "Choose clerk, senior or lead");
    out.role = d.role;
  }
  if (upline && invite) throw new DeskError("invalid_argument", "Use either an agent code or an invite code, not both");
  return out;
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
