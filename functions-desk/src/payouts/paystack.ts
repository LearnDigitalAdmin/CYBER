/**
 * Paystack Transfers for desk payouts. Shapes verified against Paystack's official docs
 * (docs-v2.paystack.com: Creating Transfer Recipients, Single Transfers, How Transfers Work):
 *  - POST /transferrecipient {type:"mobile_money", name, account_number:"07…", bank_code:"MPESA", currency:"KES"} -> data.recipient_code
 *  - POST /transfer {source:"balance", amount (minor), reference, recipient, reason} -> data.status success|pending|otp, data.transfer_code
 *  - GET  /transfer/verify/:reference -> data.status success|failed|reversed|otp|pending; HTTP 404 when no such transfer exists
 */
import axios, { type AxiosInstance } from "axios";
import { DeskError } from "../errors.js";
import { PAYSTACK_SECRET_KEY, paystackMessage } from "../paystack/client.js";

export type TransferLookup =
  | { found: false }
  | { found: true; status: string; amountMinor: number; transferCode?: string; reference: string };

export interface TransferClient {
  createRecipient(i: { name: string; accountNumberLocal: string }): Promise<{ recipientCode: string }>;
  initiate(i: { amountMinor: number; recipientCode: string; reference: string; reason: string }): Promise<{ status: string; transferCode?: string }>;
  verify(reference: string): Promise<TransferLookup>;
}

function http(): AxiosInstance {
  return axios.create({
    baseURL: "https://api.paystack.co", timeout: 30_000,
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`, "Content-Type": "application/json" },
  });
}

export const paystackTransfers: TransferClient = {
  async createRecipient({ name, accountNumberLocal }) {
    try {
      const res = await http().post("/transferrecipient", {
        type: "mobile_money", name, account_number: accountNumberLocal, bank_code: "MPESA", currency: "KES",
      });
      const code = res.data?.data?.recipient_code as string | undefined;
      if (!res.data?.status || !code) throw new DeskError("payment_failed", res.data?.message ?? "Paystack could not create the payout recipient");
      return { recipientCode: code };
    } catch (err) {
      if (err instanceof DeskError) throw err;
      throw new DeskError("payment_failed", paystackMessage(err));
    }
  },
  async initiate({ amountMinor, recipientCode, reference, reason }) {
    try {
      const res = await http().post("/transfer", { source: "balance", amount: amountMinor, reference, recipient: recipientCode, reason });
      if (!res.data?.status) throw new DeskError("payment_failed", res.data?.message ?? "Paystack declined the transfer");
      return { status: String(res.data?.data?.status ?? "pending"), transferCode: res.data?.data?.transfer_code as string | undefined };
    } catch (err) {
      if (err instanceof DeskError) throw err;
      throw new DeskError("payment_failed", paystackMessage(err));
    }
  },
  async verify(reference) {
    try {
      const res = await http().get(`/transfer/verify/${encodeURIComponent(reference)}`, { validateStatus: (s) => (s >= 200 && s < 300) || s === 404 });
      if (res.status === 404) return { found: false };
      const d = (res.data?.data ?? {}) as { status?: string; amount?: number; transfer_code?: string };
      return { found: true, status: String(d.status ?? "unknown"), amountMinor: Number(d.amount ?? 0), transferCode: d.transfer_code, reference };
    } catch (err) {
      throw new DeskError("payment_failed", paystackMessage(err));
    }
  },
};
