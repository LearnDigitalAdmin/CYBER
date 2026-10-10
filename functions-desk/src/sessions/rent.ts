import { summaryRentStk, type InitiateRentStkOut } from "../contract.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireActiveAgent } from "../kernel/agents.js";
import { requireSession } from "../kernel/session.js";
import type { ActionOtpDoc, RentBatchDoc, SessionDoc } from "../types.js";
import type { Deps } from "../connectors/deps.js";
import { assertEntityKey } from "../connectors/entities.js";
import { record } from "../connectors/input.js";
import { RENT_STK_MAX_TENANTS } from "../otp/messages.js";
import { validateTenantIds } from "./pure.js";

/**
 * Writes the batch as `requested`; PAY executes it (it owns rent invoices and landlord subaccounts). The per-action OTP must
 * be one the customer approved for exactly this many tenants, and it is consumed here, so a batch can be requested once per OTP.
 */
export async function initiateRentStk(deps: Deps, uid: string, raw: unknown): Promise<InitiateRentStkOut> {
  const d = record(raw);
  const sessionId = typeof d.sessionId === "string" ? d.sessionId : "";
  const actionId = typeof d.actionId === "string" ? d.actionId : "";
  if (!sessionId || !actionId) throw new DeskError("invalid_argument", "Session and confirmation are required");
  const tenantIds = validateTenantIds(d.tenantIds, RENT_STK_MAX_TENANTS);
  await requireActiveAgent(uid);

  // Checks that must not burn the one-time OTP: right product, and the OTP's summary is for exactly this batch size.
  const [sSnap, aSnap] = await Promise.all([col("sessions").doc(sessionId).get(), col("actionOtps").doc(actionId).get()]);
  const session = sSnap.exists ? (sSnap.data() as SessionDoc) : undefined;
  if (!session) throw new DeskError("session_invalid", "Session not found");
  if (assertEntityKey(session.entityKey).product !== "pms") throw new DeskError("failed_precondition", "Rent STK is only available for Plot Yangu accounts");
  const action = aSnap.exists ? (aSnap.data() as ActionOtpDoc) : undefined;
  if (!action) throw new DeskError("otp_required", "Confirm this action with the customer's OTP first");
  if (action.summary !== summaryRentStk(tenantIds.length)) {
    throw new DeskError("invalid_argument", "The confirmed request does not match the tenants selected. Ask the customer to confirm again.");
  }

  // Authoritative gate (active session, scope, verified fresh unused OTP) and the one-time consumption.
  const ctx = await requireSession({ sessionId, uid, scope: "rent_stk", action: "rent_stk", actionId });

  const now = deps.now();
  const batchId = `rb_${actionId}`;
  const batch: RentBatchDoc & { count: number } = {
    batchId, agentId: uid, sessionId, entityKey: ctx.entityKey, tenantIds, status: "requested", results: [],
    count: tenantIds.length, createdAt: now, updatedAt: now,
  };
  try {
    await col("rentBatches").doc(batchId).create(batch);
  } catch (err) {
    if ((err as { code?: number }).code !== 6) throw err; // already exists: same OTP, same batch
  }
  await audit({ action: "rent_stk_requested", agentId: uid, entityKey: ctx.entityKey, sessionId, meta: { batchId, count: tenantIds.length } });
  return { batchId, count: tenantIds.length };
}
