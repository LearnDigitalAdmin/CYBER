import axios from "axios";
import { DeskError } from "../errors.js";
import { normalizeKenyaPhone } from "./phone.js";
import { paystackMessage } from "./client.js";

export interface SubaccountDetails {
  businessName: string; settlementBank: string; accountNumber: string;
  contactName: string; contactEmail: string; contactPhone: string;
  /** Free-form tags stored on the subaccount (e.g. the desk code). */
  metadata?: Record<string, unknown>;
}

/** Same body PAY's setupAccount sends. `percentage_charge` is required by Paystack but unused: every desk charge uses a split code. */
export function buildSubaccountBody(d: SubaccountDetails): Record<string, unknown> {
  if (!d.businessName.trim()) throw new DeskError("invalid_argument", "Business name is missing");
  if (!d.settlementBank.trim()) throw new DeskError("invalid_argument", "Settlement bank is missing");
  const account = d.accountNumber.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9-]{3,30}$/.test(account)) throw new DeskError("invalid_argument", "Settlement account number is invalid");
  if (!/^\S+@\S+\.\S+$/.test(d.contactEmail)) throw new DeskError("invalid_argument", "Contact email is invalid");
  return {
    business_name: d.businessName.trim(),
    settlement_bank: d.settlementBank.trim(),
    account_number: account,
    percentage_charge: 0,
    primary_contact_email: d.contactEmail.trim(),
    primary_contact_name: d.contactName.trim(),
    primary_contact_phone: normalizeKenyaPhone(d.contactPhone),
    metadata: d.metadata ?? {},
  };
}

/** Creates a subaccount in the Paystack account that owns `secretKey`. Returns its ACCT_ code. */
export async function createSubaccount(secretKey: string, d: SubaccountDetails): Promise<string> {
  try {
    const res = await axios.post("https://api.paystack.co/subaccount", buildSubaccountBody(d), {
      timeout: 30_000, headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    });
    const code = res.data?.data?.subaccount_code as string | undefined;
    if (!res.data?.status || !code) throw new DeskError("payment_failed", res.data?.message ?? "Could not create the payout account");
    return code;
  } catch (err) {
    if (err instanceof DeskError) throw err;
    throw new DeskError("payment_failed", paystackMessage(err));
  }
}
