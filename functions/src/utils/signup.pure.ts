/**
 * Pure helpers for low-friction signup (no Firebase imports, so they are unit-testable).
 */

/** Kenyan mobile -> '2547XXXXXXXX' / '2541XXXXXXXX' (digits only), or null when it is not a valid mobile. */
export function normalizeKePhone(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('254')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^[71]\d{8}$/.test(d) ? `254${d}` : null;
}

/**
 * Safaricom number ranges (first 4 digits of the local number). The prefix only tells which range a number was
 * issued from, so a number moved to another network cannot be detected. Safaricom keeps adding ranges: when a
 * Safaricom customer is rejected, add the new prefix here.
 */
const SAFARICOM_RANGES: ReadonlyArray<readonly [number, number]> = [
  [700, 709], [710, 719], [720, 729], [740, 743], [745, 748], [757, 759], [768, 769], [790, 799],
  [110, 115], [118, 119], [140, 143], [180, 182],
];
const SAFARICOM_PREFIXES: ReadonlySet<string> = new Set(
  SAFARICOM_RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => `0${a + i}`)),
);

/** True when the normalised number ('2547XXXXXXXX' / '2541XXXXXXXX') is in a Safaricom range. */
export const isSafaricom = (msisdn: string): boolean => SAFARICOM_PREFIXES.has(`0${msisdn.slice(3, 6)}`);

export const SAFARICOM_ONLY_MESSAGE = 'Please use a Safaricom number (e.g. 0712 345 678 or 0110 123 456)';

/** '254712345678' -> '0712345678' (the format agents/{uid}.phone already uses). */
export const toLocalPhone = (msisdn: string): string => `0${msisdn.slice(3)}`;

/** Same format the old client used: COG-1234 (4 digits minimum). */
export const formatPid = (n: number): string => `COG-${String(n).padStart(4, '0')}`;

/** 'COG-1234' -> 1234, anything else -> null. */
export function parsePidNumber(pid: unknown): number | null {
  if (typeof pid !== 'string') return null;
  const m = /^COG-(\d+)$/.exec(pid);
  return m ? Number(m[1]) : null;
}

/** The old client started at COG-1234 when no agent existed yet. */
export const PID_SEED = 1233;

export interface ProfileInput {
  name?: unknown;
  id?: unknown;
  phone?: unknown;
  altPhone?: unknown;
  shopName?: unknown;
  shopPhone?: unknown;
  county?: unknown;
  constituency?: unknown;
  ward?: unknown;
  addressLine?: unknown;
  /** Email a verification link was sent to but that is not verified yet. */
  pendingEmail?: unknown;
}

export interface ProfileUpdate {
  name?: string;
  id?: string;
  phone?: string;
  altPhone?: string;
  shopName?: string;
  shopPhone?: string;
  county?: string;
  constituency?: string;
  ward?: string;
  addressLine?: string;
  pendingEmail?: string;
}

export class ProfileError extends Error {}

const text = (v: unknown, max: number, label: string): string => {
  if (typeof v !== 'string') throw new ProfileError(`${label} is invalid`);
  const s = v.replace(/\s+/g, ' ').trim();
  if (s.length > max) throw new ProfileError(`${label} is too long`);
  return s;
};

const optionalPhone = (v: unknown, label: string): string => {
  const s = text(v, 30, label);
  if (!s) return '';
  const n = normalizeKePhone(s);
  if (!n) throw new ProfileError(`${label} must be a valid Kenyan mobile number`);
  return toLocalPhone(n);
};

/**
 * Validates only the keys that are present. Server-owned fields (pId, uid, paymentInfo, money totals, uploads ...)
 * are never read from the input. Blank name / id are ignored (they cannot be cleared). `lockPhone` is true when the
 * phone is the sign-in phone (phone auth), which must not be edited here.
 */
export function validateProfile(raw: ProfileInput, lockPhone: boolean, currentPhone = ''): ProfileUpdate {
  const out: ProfileUpdate = {};
  if (raw.name !== undefined) {
    const s = text(raw.name, 100, 'Name');
    if (s) {
      if (s.length < 2) throw new ProfileError('Name is too short');
      out.name = s;
    }
  }
  if (raw.id !== undefined) {
    const s = text(raw.id, 20, 'ID number').replace(/\s/g, '');
    if (s) {
      if (!/^[A-Za-z0-9]{5,15}$/.test(s)) throw new ProfileError('ID number must be 5-15 letters or digits');
      out.id = s;
    }
  }
  if (raw.phone !== undefined && !lockPhone) {
    const p = optionalPhone(raw.phone, 'Phone');
    if (p) {
      // The main phone must be Safaricom; an unchanged stored number is accepted as is.
      const n = normalizeKePhone(p) as string;
      if (p !== currentPhone && !isSafaricom(n)) throw new ProfileError(SAFARICOM_ONLY_MESSAGE);
      out.phone = p;
    }
  }
  if (raw.altPhone !== undefined) out.altPhone = optionalPhone(raw.altPhone, 'Alternative phone');
  if (raw.shopPhone !== undefined) out.shopPhone = optionalPhone(raw.shopPhone, 'Business phone');
  if (raw.shopName !== undefined) out.shopName = text(raw.shopName, 100, 'Business name');
  if (raw.county !== undefined) out.county = text(raw.county, 60, 'County');
  if (raw.constituency !== undefined) out.constituency = text(raw.constituency, 60, 'Constituency');
  if (raw.ward !== undefined) out.ward = text(raw.ward, 60, 'Ward');
  if (raw.addressLine !== undefined) out.addressLine = text(raw.addressLine, 150, 'Address');
  if (raw.pendingEmail !== undefined) {
    const e = text(raw.pendingEmail, 120, 'Email').toLowerCase();
    if (e && !/^\S+@\S+\.\S+$/.test(e)) throw new ProfileError('Enter a valid email address');
    out.pendingEmail = e;
  }
  return out;
}

/** 'Street, Ward, Constituency, County' (what the public pages show in agents/{uid}.address). */
export const composeAddress = (p: { addressLine?: string; ward?: string; constituency?: string; county?: string }): string =>
  [p.addressLine, p.ward, p.constituency, p.county].filter(Boolean).join(', ');

/**
 * What a new-flow account must have before it can use the app. Email counts when it is verified (`email`) or when a
 * verification link was already sent to it (`pendingEmail`). Returns the labels of whatever is missing.
 */
export function missingProfileFields(d: Record<string, unknown>, uid: string): string[] {
  const has = (k: string) => typeof d[k] === 'string' && (d[k] as string).trim() !== '';
  const missing: string[] = [];
  if (!has('name')) missing.push('full name');
  if (!has('id') || d.id === uid) missing.push('ID number');
  if (!has('phone')) missing.push('phone number');
  if (!has('email') && !has('pendingEmail')) missing.push('email');
  if (!has('county')) missing.push('county');
  if (!has('constituency')) missing.push('constituency');
  if (!has('ward')) missing.push('ward');
  if (!has('addressLine')) missing.push('street / landmark');
  return missing;
}
