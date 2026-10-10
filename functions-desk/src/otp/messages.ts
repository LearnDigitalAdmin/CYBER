import {
  EXPORT_KINDS, summaryBulkSms, summaryExport, summaryRentStk, type OtpAction, type Scope,
} from "../contract.js";
import { cleanSmsText, SMS_MAX_LENGTH } from "../kernel/sms.js";

export const RENT_STK_MAX_TENANTS = 200;
export const BULK_SMS_MAX_RECIPIENTS = 1_000_000;

/** Which session scope an action OTP needs. */
export const ACTION_SCOPE: Record<OtpAction, Scope> = { bulk_sms: "bulk_sms", rent_stk: "rent_stk", export: "export" };

export type SummaryCheck = { ok: true } | { ok: false; message: string };

/**
 * The summary is what the customer reads in their SMS, so it must be EXACTLY what the contract builders produce.
 * We parse the variable part and rebuild the string; anything that doesn't round-trip is refused. Pure.
 */
export function checkActionSummary(action: OtpAction, summary: unknown): SummaryCheck {
  const bad: SummaryCheck = { ok: false, message: "The confirmation text does not match the action" };
  if (typeof summary !== "string") return bad;
  if (action === "bulk_sms") {
    const m = /^SMS to (\d{1,7}) recipients$/.exec(summary);
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= BULK_SMS_MAX_RECIPIENTS && summary === summaryBulkSms(n) ? { ok: true } : bad;
  }
  if (action === "rent_stk") {
    const m = /^Rent STK to (\d{1,3}) tenants$/.exec(summary);
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= RENT_STK_MAX_TENANTS && summary === summaryRentStk(n) ? { ok: true } : bad;
  }
  const m = /^Export (\S+)$/.exec(summary);
  const kind = m ? m[1] : "";
  return (EXPORT_KINDS as readonly string[]).includes(kind) && summary === summaryExport(kind) ? { ok: true } : bad;
}

const clip = (s: string, n: number): string => {
  const t = cleanSmsText(s);
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}.` : t;
};

/** Keeps the code and fixed wording intact: only the names are shortened so the provider's length cap can never cut the OTP. */
function bounded(build: (agentName: string, entityName: string) => string, agentName: string, entityName: string): string {
  let a = 40; let e = 50;
  for (;;) {
    const msg = build(clip(agentName, a), clip(entityName, e));
    if (msg.length <= SMS_MAX_LENGTH || (a <= 8 && e <= 8)) return msg;
    a = Math.max(8, a - 8); e = Math.max(8, e - 8);
  }
}

export const accessSmsText = (agentName: string, agentCode: string, entityName: string, otp: string): string =>
  bounded((a, e) => `Samuhia Desk: ${a} (${agentCode}) asks to access ${e}. Code ${otp}, valid 5 min. Share it ONLY if you asked for help.`,
    agentName, entityName);

/** Repeats the summary so the customer sees exactly what they are approving. */
export const actionSmsText = (agentName: string, agentCode: string, summary: string, otp: string): string =>
  `Samuhia Desk: ${clip(agentName, 40)} (${agentCode}) asks to: ${summary}. Code ${otp}, valid 5 min. Share it ONLY if you asked for help.`;

/** Support confirmation. Deliberately says nothing about money or rewards. */
export const supportSmsText = (agentName: string, agentCode: string, entityName: string, category: string, code: string): string =>
  bounded((a, e) => `Samuhia Desk: ${a} (${agentCode}) logged a ${category} support visit for ${e}. Confirmation code ${code}, valid 24 h. Share it ONLY if you received help.`,
    agentName, entityName);
