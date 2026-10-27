import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { HP_SECRETS } from '../config/sms.config';
import { sendSmsMessage } from '../services/house.sms';
import { ensureAgentDoc, saveAgentProfile } from '../services/agentProfile';
import { isSafaricom, normalizeKePhone, toLocalPhone, ProfileError, SAFARICOM_ONLY_MESSAGE } from '../utils/signup.pure';

/**
 * Low-friction CYBER signup.
 *  - sendSignupOtp / verifySignupOtp : phone sign-in through the internal SMS provider. The phone is reconciled with
 *    Firebase Auth (find-or-create the Auth user by phone number) and the browser signs in with a custom token, so the
 *    uid is a real Firebase Auth uid and later logins by phone always land on the same account.
 *  - ensureAgentProfile : creates agents/{uid} (PID from a transaction) for Google sign-ups.
 *  - saveAgentProfile   : edits the profile after signup (clients cannot write agents/{uid} under the rules).
 * Desk verification is NOT touched.
 */

const REGION = 'us-central1';
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

/** signup_otps/{msisdn}: not matched by any rule, so clients can never read the hashes. */
const otpCol = () => getFirestore().collection('signup_otps');

const hashCode = (code: string, salt: string, msisdn: string): Buffer =>
  createHash('sha256').update(`${salt}:${msisdn}:${code}`).digest();

export const sendSignupOtp = onCall(
  { region: REGION, cors: true, maxInstances: 10, secrets: HP_SECRETS },
  async (request) => {
    const msisdn = normalizeKePhone(request.data?.phone);
    if (!msisdn) throw new HttpsError('invalid-argument', 'Enter a valid Kenyan mobile number');
    if (!isSafaricom(msisdn)) throw new HttpsError('invalid-argument', SAFARICOM_ONLY_MESSAGE);

    const ref = otpCol().doc(msisdn);
    const now = Date.now();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(8).toString('hex');

    await getFirestore().runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data() as
        | { sentAt?: number; windowStart?: number; sendCount?: number }
        | undefined;
      if (d?.sentAt && now - d.sentAt < RESEND_MS) {
        throw new HttpsError('resource-exhausted', 'Please wait a minute before asking for another code');
      }
      const fresh = !d?.windowStart || now - d.windowStart > 60 * 60 * 1000;
      const sendCount = fresh ? 1 : (d?.sendCount ?? 0) + 1;
      if (!fresh && sendCount > MAX_SENDS_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Too many codes requested. Try again in an hour');
      }
      tx.set(ref, {
        hash: hashCode(code, salt, msisdn).toString('hex'),
        salt,
        attempts: 0,
        sentAt: now,
        expiresAt: now + OTP_TTL_MS,
        windowStart: fresh ? now : d?.windowStart,
        sendCount,
      });
    });

    const sent = await sendSmsMessage(
      msisdn,
      `Your Samuhia CYBER code is ${code}. It expires in 5 minutes. Do not share it with anyone.`,
    );
    if (!sent) {
      await ref.update({ sentAt: 0, expiresAt: 0 }).catch(() => undefined);
      throw new HttpsError('unavailable', 'We could not send the SMS. Please try again shortly');
    }
    return { ok: true };
  },
);

export const verifySignupOtp = onCall(
  { region: REGION, cors: true, maxInstances: 10 },
  async (request) => {
    const msisdn = normalizeKePhone(request.data?.phone);
    const code = String(request.data?.code ?? '').replace(/\D/g, '');
    if (!msisdn || code.length !== 6) throw new HttpsError('invalid-argument', 'Enter the 6-digit code');
    if (!isSafaricom(msisdn)) throw new HttpsError('invalid-argument', SAFARICOM_ONLY_MESSAGE);

    const ref = otpCol().doc(msisdn);
    const now = Date.now();
    const outcome = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return 'none' as const;
      const d = snap.data() as { hash: string; salt: string; attempts: number; expiresAt: number };
      if (d.expiresAt < now) { tx.delete(ref); return 'expired' as const; }
      if (d.attempts >= MAX_ATTEMPTS) return 'locked' as const;
      const expected = Buffer.from(d.hash, 'hex');
      const actual = hashCode(code, d.salt, msisdn);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        tx.update(ref, { attempts: d.attempts + 1 });
        return 'bad' as const;
      }
      tx.delete(ref); // single use
      return 'ok' as const;
    });

    if (outcome === 'none' || outcome === 'expired') throw new HttpsError('failed-precondition', 'That code has expired. Request a new one');
    if (outcome === 'locked') throw new HttpsError('resource-exhausted', 'Too many wrong attempts. Request a new code');
    if (outcome === 'bad') throw new HttpsError('permission-denied', 'Incorrect code');

    const auth = getAuth();
    const e164 = `+${msisdn}`;
    let user;
    try {
      user = await auth.getUserByPhoneNumber(e164);
    } catch (e) {
      if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
      try {
        user = await auth.createUser({ phoneNumber: e164 });
      } catch (e2) {
        // two requests raced: the other one created it
        if ((e2 as { code?: string }).code !== 'auth/phone-number-already-exists') throw e2;
        user = await auth.getUserByPhoneNumber(e164);
      }
    }
    if (user.disabled) throw new HttpsError('permission-denied', 'This account is disabled');

    const agent = await ensureAgentDoc(user.uid, {
      method: 'phone',
      phone: toLocalPhone(msisdn),
      email: user.email && user.emailVerified ? user.email : undefined,
      name: user.displayName ?? undefined,
    });
    const token = await auth.createCustomToken(user.uid);
    return { token, isNew: agent.created };
  },
);

export const ensureAgentProfile = onCall(
  { region: REGION, cors: true, maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
    const user = await getAuth().getUser(request.auth.uid);
    const google = user.providerData.some((p) => p.providerId === 'google.com');
    const agent = await ensureAgentDoc(user.uid, {
      method: google ? 'google' : user.phoneNumber ? 'phone' : 'email',
      name: user.displayName ?? undefined,
      email: user.email && user.emailVerified ? user.email : undefined,
      phone: user.phoneNumber ? toLocalPhone(user.phoneNumber.replace(/\D/g, '')) : undefined,
    });
    return { isNew: agent.created, pId: agent.pId };
  },
);

export const updateAgentProfile = onCall(
  { region: REGION, cors: true, maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
    try {
      return await saveAgentProfile(request.auth.uid, (request.data ?? {}) as Record<string, unknown>);
    } catch (e) {
      if (e instanceof ProfileError) throw new HttpsError('invalid-argument', e.message);
      throw e;
    }
  },
);
