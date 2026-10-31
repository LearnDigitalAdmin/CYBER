import { normalizeKenyaPhone, phoneProblem } from "../access/phone";

export interface ApplicationFields {
  name: string; phone: string; idNumber: string;
  county: string; constituency: string; ward: string;
  /** Optional: a senior's (you become a clerk), lead's (senior) or admin's (lead) desk code. */
  uplineCode: string;
  /** Optional: an invite code; the role comes from the invite. */
  inviteCode: string;
  /** Only offered when the ward already has the hierarchy; empty means clerk under Samuhia. */
  role: "" | "clerk" | "senior" | "lead";
}
export type ApplicationErrors = Partial<Record<keyof ApplicationFields, string>>;

/** Same limits the server enforces in desk_applyAgent: name 2-80, Safaricom phone, ID 6-12 digits, a real county/constituency/ward, valid codes. */
export function validateApplication(f: ApplicationFields): ApplicationErrors {
  const e: ApplicationErrors = {};
  const name = f.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) e.name = "Enter your full name (2 to 80 characters).";
  { const p = phoneProblem(f.phone); if (p) e.phone = p; }
  if (!/^\d{6,12}$/.test(f.idNumber.trim())) e.idNumber = "Your ID number is 6 to 12 digits, numbers only.";
  if (!f.county) e.county = "Choose your county.";
  if (!f.constituency) e.constituency = "Choose your constituency.";
  if (!f.ward) e.ward = "Choose your ward.";
  const up = f.uplineCode.trim().toUpperCase(), inv = f.inviteCode.trim().toUpperCase();
  if (up && !/^COG-\d{4,}$/.test(up)) e.uplineCode = "An agent code looks like COG-0123.";
  if (inv && !/^[A-HJKMNP-Z2-9]{8}$/.test(inv)) e.inviteCode = "An invite code is 8 letters and numbers.";
  if (up && inv) e.inviteCode = "Use an agent code or an invite code, not both.";
  return e;
}

/** Cleaned values exactly as they are sent (`wardId` stays for older servers and is ignored when the names are sent). */
export function cleanApplication(f: ApplicationFields) {
  const up = f.uplineCode.trim().toUpperCase(), inv = f.inviteCode.trim().toUpperCase();
  return {
    name: f.name.trim().replace(/\s+/g, " "),
    phone: normalizeKenyaPhone(f.phone.trim()) ?? f.phone.trim(),
    idNumber: f.idNumber.trim(),
    wardId: f.ward.trim(),
    county: f.county, constituency: f.constituency, ward: f.ward,
    ...(up ? { uplineCode: up } : {}), ...(inv ? { inviteCode: inv } : {}),
    ...(!up && !inv && f.role ? { role: f.role } : {}),
  };
}
