/**
 * Shared harness for the emulator suites: injectable SMS / delegate / Paystack doubles and Firestore seeding.
 * Test doubles live only in test files; this file defines no tests of its own.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { DEFAULT_DESK_CONFIG, type DeskConfig } from "../config.js";
import type { Product } from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import type { AgentDoc } from "../types.js";
import type { Deps } from "./deps.js";
import { requestAccess, verifyAccess } from "../sessions/access.js";

export type DelegateHandler = (product: Product, req: { action: string; entityCode: string; agentCode: string; requestId?: string; payload: unknown }) => unknown;

export interface Harness {
  deps: Deps;
  sms: { to: string; message: string }[];
  calls: { product: Product; req: Parameters<DelegateHandler>[1] }[];
  state: { delegate: DelegateHandler; smsFails: boolean; cfg: DeskConfig; subaccountCalls: number; subaccountFails: boolean };
  chama: Firestore;
}

export const CHAMA_PROJECT = "demo-chama";
export function chamaDb(): Firestore {
  const app = getApps().find((a) => a.name === "test-chama") ?? initializeApp({ projectId: CHAMA_PROJECT }, "test-chama");
  return getFirestore(app);
}

export const ADMIN_PHONE = "0722000111";
export const entityInfo = (o: Record<string, unknown> = {}) => ({
  displayName: "Umoja Chama", adminName: "Chair", adminPhone: ADMIN_PHONE, agentAuthorised: true, plan: "pro",
  creditsBalance: 100, audiences: ["all"], reportTypes: [], exportKinds: ["members"], ...o,
});

export function harness(): Harness {
  const h: Harness = {
    sms: [], calls: [], chama: chamaDb(),
    state: { delegate: () => entityInfo(), smsFails: false, cfg: { ...DEFAULT_DESK_CONFIG }, subaccountCalls: 0, subaccountFails: false },
    deps: undefined as unknown as Deps,
  };
  h.deps = {
    now: () => Date.now(),
    getConfig: async () => h.state.cfg,
    sendSms: async (to, message) => { if (h.state.smsFails) throw new DeskError("internal", "sms down"); h.sms.push({ to, message }); },
    delegate: async <T>(_cfg: DeskConfig, product: Product, req: { action: string; entityCode: string; agentCode: string; requestId?: string; payload: unknown }) => {
      h.calls.push({ product, req });
      return h.state.delegate(product, req) as T;
    },
    chamaDb: () => h.chama,
    chamaPaystack: {
      resolveBankCode: async (b) => b.toUpperCase(),
      createSubaccount: async () => {
        h.state.subaccountCalls++;
        await new Promise((r) => setTimeout(r, 40));
        if (h.state.subaccountFails) throw new DeskError("payment_failed", "Paystack said no");
        return `ACCT_chama${h.state.subaccountCalls}`;
      },
    },
    randomOtp: () => String(100000 + Math.floor(Math.random() * 899999)),
  };
  return h;
}

export async function clearChama(): Promise<void> {
  const c = chamaDb();
  for (const d of (await c.collection("chamas").get()).docs) await d.ref.delete();
}

export async function seedAgent(uid: string, o: Partial<AgentDoc> = {}, withPayment = true): Promise<AgentDoc> {
  const agent: AgentDoc = {
    agentId: uid, agentCode: `COG-${uid.replace(/\D/g, "").padStart(4, "0")}`, name: `Agent ${uid}`, phone: "+254711000000",
    email: `${uid}@x.co`, idHash: `h-${uid}`, idNumberMasked: "****0000", status: "active", rank: "clerk", wardId: "w1", createdAt: 1, ...o,
  };
  await col("agents").doc(uid).set(agent);
  if (withPayment) {
    await db().collection("agents").doc(uid).set({
      email: agent.email, paymentInfo: {
        accountId: `ACCT_main_${uid}`, businessName: "Biz", settlementBank: "mpesa", accountNumber: "0711000000",
        name: agent.name, email: agent.email, phone: "254711000000",
      },
    });
  }
  return agent;
}

export const lastOtp = (h: Harness): string => {
  const m = /(?:Code|code) (\d{6})/.exec(h.sms[h.sms.length - 1]?.message ?? "");
  if (!m) throw new Error("no OTP in last SMS");
  return m[1];
};

/** Real request + verify through the handlers. Returns the verified session id. */
export async function openSession(h: Harness, uid: string, entityKey: string, scopes: string[]): Promise<string> {
  const r = await requestAccess(h.deps, uid, { entityKey, scopes });
  await verifyAccess(h.deps, uid, { sessionId: r.sessionId, otp: lastOtp(h) });
  return r.sessionId;
}

export async function rejects(p: Promise<unknown>, code: string, msg?: RegExp): Promise<void> {
  try { await p; } catch (err) {
    if (!(err instanceof DeskError)) throw err;
    if (err.code !== code) throw new Error(`expected ${code}, got ${err.code}: ${err.message}`);
    if (msg && !msg.test(err.message)) throw new Error(`message ${err.message} !~ ${msg}`);
    return;
  }
  throw new Error(`expected rejection with ${code}`);
}
