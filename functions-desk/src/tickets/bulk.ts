/**
 * Real recipient count and credits for a bulk reminder, measured by the PRODUCT itself (send_sms_now with dryRun: true sends
 * and charges nothing), plus the customer's credit balance from entity_info. Used both to quote and, again, at charge time
 * to recompute the amount the customer's per-action OTP must describe.
 */
import type { DeskConfig } from "../config.js";
import type { DelegateEntityInfo, DelegateSendResult, Product } from "../contract.js";
import { DeskError } from "../errors.js";
import { parseEntityKey } from "../entity.js";
import { callDelegate, type DelegateOptions } from "../kernel/delegate.js";

export interface BulkMeasurement { recipients: number; credits: number; balance: number }

const wholeNumber = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

export interface MeasureArgs {
  cfg: DeskConfig; product: Product; entityKey: string; agentCode: string;
  audience: string; message: string; delegate?: DelegateOptions;
}

export async function measureBulkReminder(a: MeasureArgs): Promise<BulkMeasurement> {
  const base = { entityCode: parseEntityKey(a.entityKey).code, agentCode: a.agentCode };
  const [dry, info] = await Promise.all([
    callDelegate<DelegateSendResult>(a.cfg, a.product,
      { ...base, action: "send_sms_now", payload: { message: a.message, audience: a.audience, dryRun: true } }, a.delegate),
    callDelegate<DelegateEntityInfo>(a.cfg, a.product, { ...base, action: "entity_info", payload: {} }, a.delegate),
  ]);
  if (!wholeNumber(dry?.queued) || !wholeNumber(dry?.creditsUsed) || !wholeNumber(info?.creditsBalance))
    throw new DeskError("internal", `The ${a.product} service returned an unreadable recipient count. Please try again.`);
  if (!info.agentAuthorised) throw new DeskError("permission_denied", "The customer has not authorised this desk");
  if (dry.queued < 1) throw new DeskError("failed_precondition", "No one matches this audience, so there is nothing to send");
  if (dry.creditsUsed > info.creditsBalance) {
    throw new DeskError("failed_precondition",
      `Not enough SMS credits: this reminder needs ${dry.creditsUsed} credits but the customer has ${info.creditsBalance}. Ask them to top up first.`);
  }
  return { recipients: dry.queued, credits: dry.creditsUsed, balance: info.creditsBalance };
}
