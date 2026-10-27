/**
 * House to Rent: data access. Admin SDK only; the bot is the only thing that touches these collections.
 *
 *  - units/{ownerId}_{unitId}                       PUBLIC listing, mirrored by Plot Yangu (mirrorPublicUnit). Unit facts only.
 *  - users/{uid}/properties/{pid}  (ownerId == PYP-NNNN)   gives the address; its parent user is the property manager.
 *  - users/{uid}.tokens                              the manager's SMS credits, charged for each inquiry.
 *  - users/{uid}/sms-sent-log                        the existing SMS audit log (every inquiry is written there too).
 *  - houseInquiries                                  one document per inquiry attempt that reached the provider.
 *  - houseInquiryLimits/{phone}_{day}                per-tenant daily cap, so nobody can drain a landlord's credits.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.config';
import { bestMatches } from '../utils/house.match';
import { nairobiToday, normalizeKenyanPhone } from '../utils/watch.format';
import { logger } from '../utils/logger';
import { composeInquirySms, firstName, MIN_INQUIRY_CREDITS, sendSmsMessage, smsCredits } from './house.sms';

export const MAX_RESULTS = 60;
export const MAX_INQUIRIES_PER_DAY = 1;

const VACANT_TTL_MS = 60_000;
const PROPERTY_TTL_MS = 10 * 60_000;

export interface VacantUnit {
  ownerId: string;
  unitId: number;
  /** The property manager's account (users/{userId}). Internal: never shown to the tenant. */
  userId: string;
  propertyId: number;
  unitNumber: string;
  unitType: string;
  unitSize: string;
  condition: string;
  rentAmount: number;
  depositAmount: number;
  propertyName: string;
  address: string;
}

interface PublicUnit {
  ownerId: string;
  unitId: number;
  unitNumber: string;
  unitType: string;
  unitSize: string;
  condition: string;
  rentAmount: number;
  depositAmount: number;
}

interface PropertyRef {
  ownerId: string;
  userId: string;
  propertyId: number;
  name: string;
  address: string;
}

export interface Manager {
  userId: string;
  name: string;
  firstName: string;
  company: string;
  /** As stored, shown to the tenant as it is (contact details are never masked). */
  phone: string;
  email: string;
  /** Where the inquiry SMS goes (E.164), or null when the account has no usable mobile number. */
  smsPhone: string | null;
  tokens: number;
}

// ── Caches (per function instance; short so a unit that was just let disappears quickly) ──

let vacantCache: { at: number; units: PublicUnit[] } | null = null;
const propertyCache = new Map<string, { at: number; prop: PropertyRef | null }>();

/** Test hook. */
export function clearHouseCaches(): void {
  vacantCache = null;
  propertyCache.clear();
}

async function loadVacantUnits(): Promise<PublicUnit[]> {
  if (vacantCache && Date.now() - vacantCache.at < VACANT_TTL_MS) return vacantCache.units;
  const snap = await db.collection('units').where('status', '==', 'vacant').get();
  const units: PublicUnit[] = [];
  for (const d of snap.docs) {
    const u = d.data();
    if (!u.ownerId) continue;
    units.push({
      ownerId: String(u.ownerId),
      unitId: Number(u.unitId ?? d.id.split('_').pop()),
      unitNumber: String(u.unitNumber ?? ''),
      unitType: String(u.unitType ?? 'residential'),
      unitSize: String(u.unitSize ?? 'other'),
      condition: String(u.condition ?? 'maintained'),
      rentAmount: Number(u.rentAmount) || 0,
      depositAmount: Number(u.depositAmount) || 0,
    });
  }
  vacantCache = { at: Date.now(), units };
  return units;
}

function toPropertyRef(d: FirebaseFirestore.QueryDocumentSnapshot): PropertyRef | null {
  // users/{uid}/properties/{pid}: anything else named `properties` is not ours
  const userDoc = d.ref.parent.parent;
  if (!userDoc || userDoc.parent.id !== 'users') return null;
  const p = d.data();
  if (!p.ownerId) return null;
  return {
    ownerId: String(p.ownerId),
    userId: userDoc.id,
    propertyId: Number(d.id),
    name: String(p.name ?? ''),
    address: String(p.address ?? ''),
  };
}

/** Preferred path: one collection-group query per 30 owners (needs the properties.ownerId collection-group index). */
async function lookupByIndex(ownerIds: string[]): Promise<PropertyRef[]> {
  const found: PropertyRef[] = [];
  for (let i = 0; i < ownerIds.length; i += 30) {
    const snap = await db.collectionGroup('properties').where('ownerId', 'in', ownerIds.slice(i, i + 30)).get();
    for (const d of snap.docs) {
      const ref = toPropertyRef(d);
      if (ref) found.push(ref);
    }
  }
  return found;
}

/** Fallback while the index is not deployed yet: read every account's properties. Slower, same answer. */
async function lookupByScan(ownerIds: string[]): Promise<PropertyRef[]> {
  const wanted = new Set(ownerIds);
  const found: PropertyRef[] = [];
  const users = await db.collection('users').listDocuments();
  for (let i = 0; i < users.length; i += 25) {
    const snaps = await Promise.all(users.slice(i, i + 25).map((u) => u.collection('properties').get()));
    for (const snap of snaps) {
      for (const d of snap.docs) {
        const ref = toPropertyRef(d);
        if (ref && wanted.has(ref.ownerId)) found.push(ref);
      }
    }
  }
  return found;
}

async function propertiesByOwner(ownerIds: string[]): Promise<PropertyRef[]> {
  const now = Date.now();
  const missing = ownerIds.filter((id) => {
    const c = propertyCache.get(id);
    return !c || now - c.at > PROPERTY_TTL_MS;
  });
  if (missing.length) {
    let found: PropertyRef[];
    try {
      found = await lookupByIndex(missing);
    } catch (error) {
      logger.warn('House to Rent: properties.ownerId index unavailable, scanning accounts instead', {
        reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
      });
      found = await lookupByScan(missing);
    }
    const byOwner = new Map(found.map((p) => [p.ownerId, p]));
    for (const id of missing) propertyCache.set(id, { at: now, prop: byOwner.get(id) ?? null });
  }
  return ownerIds.map((id) => propertyCache.get(id)?.prop ?? null).filter((p): p is PropertyRef => !!p);
}

/**
 * Public vacant units whose property address loosely matches `area` ("mirer", "navsha", "NAIVASHA" ...).
 * Cheapest first, at most MAX_RESULTS.
 */
export async function findVacantUnits(area: string): Promise<VacantUnit[]> {
  const vacant = await loadVacantUnits();
  if (!vacant.length) return [];
  const owners = [...new Set(vacant.map((u) => u.ownerId))];
  const props = await propertiesByOwner(owners);
  // Address first; the property name also counts ("Naivasha Villas")
  const matched = bestMatches(area, props, (p) => `${p.address} ${p.name}`);
  const byOwner = new Map(matched.map((p) => [p.ownerId, p]));

  return vacant
    .filter((u) => byOwner.has(u.ownerId))
    .map((u): VacantUnit => {
      const p = byOwner.get(u.ownerId)!;
      return { ...u, userId: p.userId, propertyId: p.propertyId, propertyName: p.name, address: p.address };
    })
    .sort((a, b) => a.rentAmount - b.rentAmount || a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }))
    .slice(0, MAX_RESULTS);
}

/** Fresh check, straight from the public listing, that the unit is still vacant. */
export async function isStillVacant(unit: Pick<VacantUnit, 'ownerId' | 'unitId'>): Promise<boolean> {
  const snap = await db.collection('units').doc(`${unit.ownerId}_${unit.unitId}`).get();
  return snap.exists && snap.data()?.status === 'vacant';
}

/** The property management account behind a unit: contact details (unmasked), SMS number and credit balance. */
export async function getManager(userId: string): Promise<Manager | null> {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) return null;
  const u = snap.data() ?? {};
  const company = (u.company && typeof u.company === 'object' ? u.company : {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const name = str(u.name) || str(company.name);
  const smsPhone = [u.phone, company.phone].map((p) => normalizeKenyanPhone(str(p))).find((p): p is string => !!p) ?? null;
  return {
    userId,
    name,
    firstName: firstName(name),
    company: str(company.name),
    phone: str(company.phone) || str(u.phone),
    email: str(company.email) || str(u.email),
    smsPhone,
    tokens: Number(u.tokens) || 0,
  };
}

/** Send Inquiry is offered only when the account can actually receive an SMS and has credits for the cheapest one. */
export const canSendInquiry = (m: Manager | null): boolean => !!m && !!m.smsPhone && m.tokens >= MIN_INQUIRY_CREDITS;

/** `+254712345678` -> `0712345678`: how a Kenyan reads a number. */
export const toLocalPhone = (e164: string): string => (e164.startsWith('+254') ? '0' + e164.slice(4) : e164);

export type InquiryFailure = 'gone' | 'no_sms' | 'no_credits' | 'limit' | 'duplicate' | 'failed';

export type InquiryPreview = { ok: true; sms: string; managerName: string; credits: number } | { ok: false; reason: InquiryFailure };
export type InquiryResult = { ok: true; managerName: string; credits: number } | { ok: false; reason: InquiryFailure };

/** The exact SMS that would go out and what it costs, or why it cannot. Nothing is charged or written. */
export async function previewInquiry(unit: VacantUnit, inquirerE164: string): Promise<InquiryPreview> {
  if (!(await isStillVacant(unit))) return { ok: false, reason: 'gone' };
  const manager = await getManager(unit.userId);
  if (!manager || !manager.smsPhone) return { ok: false, reason: 'no_sms' };
  const sms = composeInquirySms({
    managerName: manager.name,
    inquirerPhone: toLocalPhone(inquirerE164),
    unitNumber: unit.unitNumber,
    propertyName: unit.propertyName,
  });
  const credits = smsCredits(sms.length);
  if (credits === null || manager.tokens < credits) return { ok: false, reason: 'no_credits' };
  return { ok: true, sms, managerName: manager.name || manager.company, credits };
}

/**
 * Send the inquiry: reserve the credits and the tenant's daily allowance in ONE transaction, send, and put both back
 * if the provider refuses. The charge goes to the manager's account (users/{uid}.tokens).
 */
export async function sendInquiry(unit: VacantUnit, inquirerE164: string): Promise<InquiryResult> {
  const preview = await previewInquiry(unit, inquirerE164);
  if (!preview.ok) return preview;
  const manager = await getManager(unit.userId);
  if (!manager || !manager.smsPhone) return { ok: false, reason: 'no_sms' };

  const { sms, credits } = preview;
  const digits = inquirerE164.replace(/\D/g, '');
  const day = nairobiToday(Date.now());
  const unitKey = `${unit.ownerId}_${unit.unitId}`;
  const userRef = db.collection('users').doc(unit.userId);
  const limitRef = db.collection('houseInquiryLimits').doc(`${digits}_${day}`);

  const reserved = await db.runTransaction(async (tx): Promise<'ok' | 'duplicate' | 'limit' | 'no_credits'> => {
    const [userSnap, limitSnap] = await Promise.all([tx.get(userRef), tx.get(limitRef)]);
    const used = (limitSnap.data() ?? {}) as { count?: number; units?: string[] };
    const units = Array.isArray(used.units) ? used.units : [];
    if (units.includes(unitKey)) return 'duplicate';
    if ((used.count ?? 0) >= MAX_INQUIRIES_PER_DAY) return 'limit';
    if ((Number(userSnap.data()?.tokens) || 0) < credits) return 'no_credits';
    tx.update(userRef, { tokens: FieldValue.increment(-credits) });
    tx.set(limitRef, { phone: digits, day, count: (used.count ?? 0) + 1, units: [...units, unitKey], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return 'ok';
  });
  if (reserved !== 'ok') return { ok: false, reason: reserved };

  const sent = await sendSmsMessage(manager.smsPhone, sms);

  if (!sent) {
    try {
      await db.runTransaction(async (tx) => {
        const limitSnap = await tx.get(limitRef);
        const used = (limitSnap.data() ?? {}) as { count?: number; units?: string[] };
        tx.update(userRef, { tokens: FieldValue.increment(credits) });
        tx.set(limitRef, { count: Math.max(0, (used.count ?? 1) - 1), units: (used.units ?? []).filter((k) => k !== unitKey) }, { merge: true });
      });
    } catch (error) {
      // The tenant's SMS did not go out and the refund did not land: this needs a human, so make it findable.
      logger.error('House to Rent: refund after a failed SMS did not complete', { userId: unit.userId, credits, unitKey, error });
    }
  }

  await writeInquiryLogs({ unit, manager, inquirerE164, sms, credits, sent });
  return sent ? { ok: true, managerName: preview.managerName, credits } : { ok: false, reason: 'failed' };
}

async function writeInquiryLogs(a: { unit: VacantUnit; manager: Manager; inquirerE164: string; sms: string; credits: number; sent: boolean }): Promise<void> {
  const charged = a.sent ? a.credits : 0;
  try {
    // The audit log the Plot Yangu app already keeps for every SMS (same shape, plus what makes an inquiry traceable)
    await db.collection('users').doc(a.unit.userId).collection('sms-sent-log').add({
      source: 'whatsapp_house_to_rent',
      propertyId: a.unit.propertyId,
      unitId: a.unit.unitId,
      unitNumber: a.unit.unitNumber,
      recipientCount: 1,
      tokensCharged: charged,
      successCount: a.sent ? 1 : 0,
      failCount: a.sent ? 0 : 1,
      inquirerPhone: a.inquirerE164,
      message: a.sms,
      sentAt: FieldValue.serverTimestamp(),
    });
    await db.collection('houseInquiries').add({
      ownerId: a.unit.ownerId,
      unitId: a.unit.unitId,
      unitNumber: a.unit.unitNumber,
      propertyName: a.unit.propertyName,
      managerUserId: a.unit.userId,
      managerSmsPhone: a.manager.smsPhone,
      inquirerPhone: a.inquirerE164,
      message: a.sms,
      messageLength: a.sms.length,
      credits: a.credits,
      tokensCharged: charged,
      status: a.sent ? 'sent' : 'failed',
      createdAt: FieldValue.serverTimestamp(),
    });
    if (a.sent) await db.collection('users').doc(a.unit.userId).update({ smsSentTotal: FieldValue.increment(1) });
  } catch (error) {
    logger.error('House to Rent: could not write the inquiry log', { userId: a.unit.userId, error });
  }
}
