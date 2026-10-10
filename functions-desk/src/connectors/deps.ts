/**
 * Everything a desk handler needs from the outside world, behind one interface so emulator tests can substitute SMS,
 * Paystack and the product delegates. Production wiring is `defaultDeps()`; test doubles live only in test files.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import axios from "axios";
import { randomInt } from "node:crypto";
import type { DeskConfig } from "../config.js";
import type { DelegateRequest, Product } from "../contract.js";
import { getConfig } from "../db.js";
import { DeskError } from "../errors.js";
import { callDelegate } from "../kernel/delegate.js";
import { sendSms } from "../kernel/sms.js";
import { MYCHAMA_PAYSTACK_SECRET_KEY, paystackMessage } from "../paystack/client.js";
import { createSubaccount, type SubaccountDetails } from "../paystack/subaccount.js";

export interface ChamaPaystack {
  /** Paystack bank code for what the agent chose at payout setup ("mpesa", "airtel-ke", …), looked up in MyChama's account. */
  resolveBankCode(settlementBank: string): Promise<string>;
  /** Creates the subaccount in MyChama's OWN Paystack account. Returns its ACCT_ code. */
  createSubaccount(details: SubaccountDetails): Promise<string>;
}

export interface Deps {
  now(): number;
  getConfig(): Promise<DeskConfig>;
  sendSms(phoneE164: string, message: string): Promise<void>;
  delegate<T>(cfg: DeskConfig, product: Product, req: Omit<DelegateRequest, "requestId"> & { requestId?: string }): Promise<T>;
  /** Admin SDK handle on the Chama project's Firestore (desk reaches Chama; Chama never reaches desk). */
  chamaDb(cfg: DeskConfig): Firestore;
  chamaPaystack: ChamaPaystack;
  randomOtp(): string;
}

/** Six digits from a CSPRNG, zero-padded. */
export const randomOtp = (): string => randomInt(0, 1_000_000).toString().padStart(6, "0");

export function chamaFirestore(cfg: DeskConfig): Firestore {
  const projectId = (cfg.projects.chama ?? "").trim();
  if (!projectId) throw new DeskError("failed_precondition", "The MyChama project is not connected yet");
  const name = `desk-chama-${projectId}`;
  const app = getApps().find((a) => a.name === name) ?? initializeApp({ projectId }, name);
  return getFirestore(app);
}

interface PaystackBank { code?: string; name?: string }

/** Same matching rules PAY's setupAccount applies to the agent's stored `settlementBank`. Pure. */
export function matchBankCode(banks: readonly PaystackBank[], settlementBank: string): string {
  const want = settlementBank.trim().toLowerCase();
  const hit = banks.find((b) =>
    b.code?.toLowerCase() === want ||
    b.name?.toLowerCase().includes(want) ||
    (want === "mpesa" && b.name?.toLowerCase().includes("m-pesa")));
  return hit?.code ?? want;
}

const mychamaPaystack: ChamaPaystack = {
  async resolveBankCode(settlementBank) {
    try {
      const res = await axios.get("https://api.paystack.co/bank", {
        params: { country: "kenya" }, timeout: 20_000,
        headers: { Authorization: `Bearer ${MYCHAMA_PAYSTACK_SECRET_KEY.value()}` },
      });
      return matchBankCode((res.data?.data ?? []) as PaystackBank[], settlementBank);
    } catch (err) {
      throw new DeskError("payment_failed", paystackMessage(err));
    }
  },
  createSubaccount: (details) => createSubaccount(MYCHAMA_PAYSTACK_SECRET_KEY.value(), details),
};

export function defaultDeps(): Deps {
  return {
    now: () => Date.now(),
    getConfig,
    sendSms,
    delegate: (cfg, product, req) => callDelegate(cfg, product, req),
    chamaDb: chamaFirestore,
    chamaPaystack: mychamaPaystack,
    randomOtp,
  };
}
