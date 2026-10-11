/** TEST-ONLY fixtures shared by the operations-backend flow suites. Defines no tests. */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { DEFAULT_DESK_CONFIG, type DeskConfig } from "../config.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import type { AuthLike } from "../kernel/topdesk.js";
import { hashOtp } from "../otp/core.js";
import { emulatorEnabled } from "../testing/emulator.js";
import { FakeFirestore } from "../ledger/fakefs.test.js";
import type { AgentDoc } from "../types.js";

export async function rejects(p: Promise<unknown>, code: string, msg?: RegExp): Promise<void> {
  try { await p; } catch (err) {
    if (!(err instanceof DeskError)) throw err;
    if (err.code !== code) throw new Error(`expected ${code}, got ${err.code}: ${err.message}`);
    if (msg && !msg.test(err.message)) throw new Error(`message "${err.message}" !~ ${msg}`);
    return;
  }
  throw new Error(`expected rejection with ${code}`);
}

/** A product project's Firestore: a second in-memory store, or a separate emulator project. */
export function productStore(name: string): { db: Firestore; reset(): Promise<void> } {
  if (!emulatorEnabled) {
    const fs = new FakeFirestore();
    return { db: fs as unknown as Firestore, reset: async () => { fs.clear(); } };
  }
  const app = getApps().find((a) => a.name === `test-${name}`) ?? initializeApp({ projectId: `demo-${name}` }, `test-${name}`);
  const f = getFirestore(app);
  return {
    db: f,
    reset: async () => { for (const c of ["desk_requests", "desk_public_config"]) for (const d of (await f.collection(c).get()).docs) await d.ref.delete(); },
  };
}

export const TOP_UID = "top1";
export const NOW_SEC = (): number => Math.floor(Date.now() / 1000);

export async function seedAgent(uid: string, o: Partial<AgentDoc> = {}, pay: Record<string, unknown> | false = {}): Promise<AgentDoc> {
  const n = uid.replace(/\D/g, "").padStart(4, "0");
  const agent: AgentDoc = {
    agentId: uid, agentCode: `COG-${n}`, name: `Agent ${uid}`, phone: "+254711000000", email: `${uid}@x.co`, idHash: `h-${uid}`,
    idNumberMasked: "****1234", status: "active", rank: "clerk", wardId: "w1", createdAt: 1_000 + Number(n), ...o,
  };
  await col("agents").doc(uid).set(agent);
  if (pay !== false) {
    await db().collection("agents").doc(uid).set({
      email: agent.email, paymentInfo: { accountId: `ACCT_main_${uid}`, settlementBank: "mpesa", accountNumber: "0711000000", ...pay },
    });
  }
  return agent;
}

export async function seedTop(o: Partial<AgentDoc> = {}): Promise<AgentDoc> {
  return seedAgent(TOP_UID, { agentCode: "COG-0000", name: "Top Desk", phone: "+254700000001", email: "boss@samuhia.co.ke", rank: "lead", ...o }, false);
}
export const topAuth = (o: { email?: string; verified?: boolean; authTime?: number; uid?: string } = {}): AuthLike => ({
  uid: o.uid ?? TOP_UID,
  token: { email: o.email ?? "boss@samuhia.co.ke", email_verified: o.verified ?? true, auth_time: o.authTime ?? NOW_SEC() },
});

export const cfgWith = (o: Partial<DeskConfig> = {}): DeskConfig => ({ ...DEFAULT_DESK_CONFIG, ...o });

/** Writes a top-desk OTP document directly so a test can use a code it knows. */
export async function seedTopOtp(actionId: string, action: string, summary: string, otp = "123456", o: Record<string, unknown> = {}): Promise<void> {
  await col("topOtps").doc(actionId).set({
    actionId, uid: TOP_UID, action, summary, otpHash: hashOtp(otp, actionId), otpAttempts: 0, otpExpiresAt: Date.now() + 300_000, createdAt: Date.now(), ...o,
  });
}

export async function seedLedger(entryId: string, agentId: string, o: Record<string, unknown> = {}): Promise<void> {
  await col("ledger").doc(entryId).set({
    entryId, agentId, kind: "bonus", amountMinor: 200_000, status: "payable", sourceId: "block-1", note: "Milestone block 1", createdAt: 1_000, ...o,
  });
}
/** 28 lowercase hex chars, like real ledger ids. */
export const eid = (n: number): string => n.toString(16).padStart(28, "0");
