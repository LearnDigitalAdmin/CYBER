import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  PID_SEED, composeAddress, formatPid, missingProfileFields, parsePidNumber, validateProfile, type ProfileInput,
} from '../utils/signup.pure';

/** Root `counters/{id}` is server-only in the rules. */
const PID_COUNTER = 'cyber_agent_pid';

export interface EnsureSeed {
  method: 'google' | 'phone' | 'email';
  name?: string;
  /** Only pass an email that Firebase Auth has verified. */
  email?: string;
  /** Local format, e.g. 0712345678 */
  phone?: string;
}

/**
 * Creates agents/{uid} when it does not exist. The PID (COG-####) comes from a transactional counter, so two
 * signups can never receive the same PID. The counter never goes below the highest existing PID, which also covers
 * agents created by the old client-side signup. Shape matches the old SignupPage document.
 */
export async function ensureAgentDoc(uid: string, seed: EnsureSeed): Promise<{ created: boolean; pId: string }> {
  const db = getFirestore();
  const agentRef = db.collection('agents').doc(uid);
  const counterRef = db.collection('counters').doc(PID_COUNTER);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(agentRef);
    if (existing.exists) return { created: false, pId: String(existing.data()?.pId ?? '') };

    const counter = await tx.get(counterRef);
    const top = await tx.get(db.collection('agents').orderBy('pId', 'desc').limit(1));
    const fromCounter = counter.exists ? Number(counter.data()?.value) : NaN;
    const fromTop = top.empty ? null : parsePidNumber(top.docs[0].data().pId);
    const last = Math.max(Number.isFinite(fromCounter) ? fromCounter : 0, fromTop ?? 0, PID_SEED);
    const next = last + 1;
    const pId = formatPid(next);

    tx.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() });
    tx.create(agentRef, {
      uid,
      pId,
      type: 'Freelancer',
      name: seed.name ?? '',
      // Desk and the public upload page fall back to the uid when no national ID is known yet.
      id: uid,
      phone: seed.phone ?? '',
      altPhone: '',
      email: seed.email ? seed.email.toLowerCase() : '',
      emailVerified: !!seed.email,
      address: '',
      addressLine: '',
      county: '',
      constituency: '',
      ward: '',
      shopName: '',
      shopPhone: '',
      uploads: { passportUrl: '', idUrl: '', kraUrl: '', shopUrl: '' },
      coords: null,
      isVerified: true,
      signupMethod: seed.method,
      profileComplete: false,
      createdAt: new Date().toISOString(),
    });
    return { created: true, pId };
  });
}

/**
 * Updates the editable profile fields of agents/{uid} (clients cannot update this doc under the rules).
 * Also copies the Auth email into the doc, but ONLY once Firebase Auth reports it as verified.
 * Throws ProfileError (from validateProfile) for bad input.
 */
export async function saveAgentProfile(
  uid: string,
  raw: ProfileInput,
): Promise<{ email: string; emailVerified: boolean; profileComplete: boolean; missing: string[] }> {
  const authUser = await getAuth().getUser(uid);

  const method: EnsureSeed['method'] = authUser.providerData.some((p) => p.providerId === 'google.com')
    ? 'google'
    : authUser.phoneNumber ? 'phone' : 'email';
  await ensureAgentDoc(uid, {
    method,
    name: authUser.displayName ?? '',
    email: authUser.email && authUser.emailVerified ? authUser.email : undefined,
    phone: authUser.phoneNumber ? `0${authUser.phoneNumber.replace(/\D/g, '').slice(-9)}` : undefined,
  });

  const db = getFirestore();
  const ref = db.collection('agents').doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = (snap.data() ?? {}) as Record<string, unknown>;
    const patch = validateProfile(raw, !!authUser.phoneNumber, String(cur.phone ?? ''));
    const update: Record<string, unknown> = { ...patch };

    const geo = {
      addressLine: patch.addressLine ?? String(cur.addressLine ?? ''),
      ward: patch.ward ?? String(cur.ward ?? ''),
      constituency: patch.constituency ?? String(cur.constituency ?? ''),
      county: patch.county ?? String(cur.county ?? ''),
    };
    if (['addressLine', 'ward', 'constituency', 'county'].some((k) => k in patch)) {
      update.address = composeAddress(geo);
    }

    let email = String(cur.email ?? '');
    let emailVerified = cur.emailVerified === true;
    if (authUser.email && authUser.emailVerified) {
      const verified = authUser.email.toLowerCase();
      if (verified !== email.toLowerCase() || !emailVerified) {
        update.email = verified;
        update.emailVerified = true;
        update.pendingEmail = '';
      }
      email = verified;
      emailVerified = true;
    }

    const merged = { ...cur, ...update } as Record<string, unknown>;
    const missing = missingProfileFields(merged, uid);
    // Only accounts created by the new signup carry `signupMethod`; older agent docs never get the flag, so they are
    // never held back by the profile gate.
    if (cur.signupMethod) update.profileComplete = missing.length === 0;

    if (Object.keys(update).length) tx.update(ref, update);
    return { email, emailVerified, profileComplete: missing.length === 0, missing };
  });
}
