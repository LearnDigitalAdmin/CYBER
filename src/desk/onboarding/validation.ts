import { normalizeKenyaPhone } from "../access/phone";

export interface ApplicationFields { name: string; phone: string; idNumber: string; ward: string }
export type ApplicationErrors = Partial<Record<keyof ApplicationFields, string>>;

/** Same limits the server enforces in desk_applyAgent: name 2-80, Kenyan phone, ID 6-12 digits, ward 1-40. */
export function validateApplication(f: ApplicationFields): ApplicationErrors {
  const e: ApplicationErrors = {};
  const name = f.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) e.name = "Enter your full name (2 to 80 characters).";
  if (!normalizeKenyaPhone(f.phone.trim())) e.phone = "Enter a valid Kenyan mobile number, for example 0712 345 678.";
  if (!/^\d{6,12}$/.test(f.idNumber.trim())) e.idNumber = "Your ID number is 6 to 12 digits, numbers only.";
  const ward = f.ward.trim();
  if (ward.length < 1 || ward.length > 40) e.ward = "Enter your ward (up to 40 characters).";
  return e;
}

/** Cleaned values exactly as they are sent. */
export function cleanApplication(f: ApplicationFields): { name: string; phone: string; idNumber: string; wardId: string } {
  return {
    name: f.name.trim().replace(/\s+/g, " "),
    phone: normalizeKenyaPhone(f.phone.trim()) ?? f.phone.trim(),
    idNumber: f.idNumber.trim(),
    wardId: f.ward.trim(),
  };
}
