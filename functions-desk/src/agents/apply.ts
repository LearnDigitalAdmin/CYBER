import { createHash, randomBytes } from "node:crypto";
import type { ApplyAgentOut, Rank } from "../contract.js";
import { getConfig } from "../db.js";
import { findAgentByCode, loadHierarchy, readSlot, writeSlot, bumpDownline, slotScopeId, type SlotRole } from "../network/hierarchy.js";
import { chainFromUpline, isInternalEmail, leastLoaded, roleForUplineCode, type Chain } from "../network/pure.js";
import { optionsFor } from "../network/hierarchy.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import type { AgentDoc, InviteDoc } from "../types.js";
import { formatAgentCode, hashIdNumber, maskIdNumber, nextCounterValue, validateApplication } from "./pure.js";

let saltCache: string | undefined;

/**
 * Per-project salt for ID-number hashes. Created once (create-only, so concurrent first calls agree) in the
 * server-only `desk_counters` collection: no new secret is needed.
 */
export async function getIdSalt(): Promise<string> {
  if (saltCache) return saltCache;
  const ref = col("counters").doc("idsalt");
  try {
    await ref.create({ salt: randomBytes(32).toString("hex"), createdAt: Date.now() });
  } catch (err) {
    if ((err as { code?: number }).code !== 6) throw err; // 6 = ALREADY_EXISTS
  }
  const salt = (await ref.get()).data()?.salt as string | undefined;
  if (!salt) throw new DeskError("internal", "Could not read the application salt");
  saltCache = salt;
  return salt;
}

const EMAIL = /^\S+@\S+\.\S+$/;
const sha = (label: string, value: string, salt: string): string => createHash("sha256").update(`${salt}:${label}:${value}`).digest("hex");
export const phoneHashOf = (phoneE164: string, salt: string): string => sha("phone", phoneE164, salt);
export const emailHashOf = (email: string, salt: string): string => sha("email", email.trim().toLowerCase(), salt);

export interface ApplyContext { emailVerified?: boolean; tokenPhone?: string }
interface Placement { role: Rank; upline?: AgentDoc; via: NonNullable<AgentDoc["joinedVia"]>; invite?: InviteDoc }

const DUPLICATE = "An account with these details already exists. Contact Samuhia support if this is a mistake.";
const scopeOk = (up: AgentDoc, g: { countyId?: string; constituencyId?: string; wardId: string }): boolean => {
  if (!up.countyId) return true; // a legacy upline has no geography to compare with
  if (!g.countyId) return false;
  if (up.rank === "senior") return up.wardId === g.wardId;
  if (up.rank === "lead") return up.constituencyId === g.constituencyId;
  if (up.rank === "admin") return up.countyId === g.countyId;
  return true;
};

/**
 * Where a joiner lands. Nobody picks a role freely: an invite fixes it, an agent code implies it (senior's code -> clerk, lead's -> senior,
 * admin's -> lead), and a self-picked role is honoured only when the people it would sit under already exist in the ward / constituency /
 * county (then the least-loaded one is chosen, which spreads joiners evenly). Everything else is a clerk under Samuhia internal.
 */
async function resolvePlacement(app: ReturnType<typeof validateApplication>, email: string, ctx: ApplyContext, now: number): Promise<Placement> {
  if (isInternalEmail(email)) {
    if (ctx.emailVerified !== true) throw new DeskError("failed_precondition", "Verify your company email address first, then apply again");
    return { role: "internal", via: "internal_domain" };
  }
  const geoOf = { countyId: app.countyId, constituencyId: app.constituencyId, wardId: app.wardId };
  if (app.inviteCode) {
    const inv = (await col("invites").doc(app.inviteCode).get()).data() as InviteDoc | undefined;
    if (!inv || inv.status !== "open" || inv.expiresAt < now) throw new DeskError("failed_precondition", "This invite is no longer valid. Ask for a new one.");
    if (inv.phone !== app.phone) throw new DeskError("permission_denied", "This invite was sent to a different phone number");
    const up = (await col("agents").doc(inv.inviterId).get()).data() as AgentDoc | undefined;
    if (!up || up.status !== "active") throw new DeskError("failed_precondition", "The agent who invited you is not active right now");
    if (!scopeOk(up, geoOf)) throw new DeskError("failed_precondition", "This invite is for a different area than the one you chose");
    return { role: inv.role, upline: up.rank === "internal" ? undefined : up, via: "invite", invite: inv };
  }
  if (app.uplineCode) {
    const up = await findAgentByCode(app.uplineCode);
    if (!up || up.status !== "active") throw new DeskError("not_found", "We could not find an active agent with that code");
    const role = roleForUplineCode(up.rank);
    if (!role) throw new DeskError("failed_precondition", "Clerks cannot add other agents. Use a senior, lead or admin code.");
    if (!scopeOk(up, geoOf)) throw new DeskError("failed_precondition", "That agent works in a different area than the one you chose");
    return { role, upline: up.rank === "internal" ? undefined : up, via: "upline_code" };
  }
  if (app.role) {
    if (!app.countyId || !app.constituencyId) throw new DeskError("invalid_argument", "Choose your county, constituency and ward to pick a role");
    const h = await loadHierarchy({ countyId: app.countyId, constituencyId: app.constituencyId, wardId: app.wardId });
    const opt = optionsFor(h, await getConfig()).find((o) => o.role === app.role);
    if (!opt?.available) {
      if (app.role === "clerk") return { role: "clerk", via: "self" };
      throw new DeskError("failed_precondition", opt?.reason ?? "That role is not available in your area");
    }
    const upline = app.role === "clerk" ? (leastLoaded(h.seniors) ?? leastLoaded(h.leads)) : app.role === "senior" ? leastLoaded(h.leads) : leastLoaded(h.admins);
    return { role: app.role, upline, via: upline ? "even_distribution" : "self" };
  }
  return { role: "clerk", via: "self" };
}

/**
 * Creates `desk_agents/{uid}` only if absent. The desk code comes from a transactional counter. One person, one account: the salted
 * ID, phone and email hashes are each locked in a create-only doc inside the same transaction, phone numbers must be Safaricom, and a
 * joiner can never share an ID, phone or email with the agent they join under. Capacity caps (4 seniors per ward, 3 leads per
 * constituency) are enforced in that transaction too. Approval is still required for everyone except verified internal staff.
 */
export async function applyAgent(uid: string, email: string | undefined, raw: unknown, now: number, ctx: ApplyContext = {}): Promise<ApplyAgentOut> {
  const app = validateApplication(raw);
  if (!email || !EMAIL.test(email)) throw new DeskError("invalid_argument", "Your account needs an email address before you can apply");
  const cleanEmail = email.trim();
  if (!isInternalEmail(cleanEmail) && ctx.emailVerified !== true && ctx.tokenPhone !== app.phone) {
    throw new DeskError("failed_precondition", "Verify your email address (or sign in with your phone number) before applying");
  }
  const salt = await getIdSalt();
  const idHash = hashIdNumber(app.idNumber, salt);
  const phoneHash = phoneHashOf(app.phone, salt);
  const emailHash = emailHashOf(cleanEmail, salt);

  // Legacy agents have no lock documents, so look them up directly as well.
  const [samePhone, sameEmail] = await Promise.all([
    col("agents").where("phone", "==", app.phone).limit(2).get(), col("agents").where("email", "==", cleanEmail).limit(2).get(),
  ]);
  if ([...samePhone.docs, ...sameEmail.docs].some((d) => d.id !== uid)) throw new DeskError("already_exists", DUPLICATE);

  const placement = await resolvePlacement(app, cleanEmail, ctx, now);
  const up = placement.upline;
  if (up && (up.phone === app.phone || up.idHash === idHash || up.email.toLowerCase() === cleanEmail.toLowerCase() || up.agentId === uid)) {
    throw new DeskError("permission_denied", "You cannot join under your own details");
  }
  const cfg = await getConfig();
  const needsSlot: SlotRole | undefined = placement.role === "senior" || placement.role === "lead" ? placement.role : undefined;
  if (needsSlot && !app.countyId) throw new DeskError("invalid_argument", "Choose your county, constituency and ward from the lists");
  const slotScope = needsSlot ? slotScopeId(needsSlot, { wardId: app.wardId, constituencyId: app.constituencyId ?? "" }) : undefined;

  const agentRef = col("agents").doc(uid);
  const counterRef = col("counters").doc("agents");
  const idLock = col("counters").doc(`idhash_${idHash}`);
  const phoneLock = col("counters").doc(`phonehash_${phoneHash}`);
  const emailLock = col("counters").doc(`emailhash_${emailHash}`);

  const result = await db().runTransaction(async (tx) => {
    const [existing, l1, l2, l3, counter, upSnap, invSnap] = await Promise.all([
      tx.get(agentRef), tx.get(idLock), tx.get(phoneLock), tx.get(emailLock), tx.get(counterRef),
      up ? tx.get(col("agents").doc(up.agentId)) : Promise.resolve(undefined),
      placement.invite ? tx.get(col("invites").doc(placement.invite.code)) : Promise.resolve(undefined),
    ]);
    if (existing.exists) return { kind: "existing" as const, status: (existing.data() as AgentDoc).status };
    if (l1.exists || l2.exists || l3.exists) return { kind: "duplicate" as const };
    const freshUp = upSnap?.data() as AgentDoc | undefined;
    if (up && (!freshUp || freshUp.status !== "active" || freshUp.rank !== up.rank)) throw new DeskError("failed_precondition", "The agent you are joining under is no longer active");
    if (placement.invite && (invSnap?.data() as InviteDoc | undefined)?.status !== "open") throw new DeskError("failed_precondition", "This invite has already been used");
    const slot = needsSlot && slotScope ? await readSlot(tx, needsSlot, slotScope, cfg) : undefined;

    const n = nextCounterValue(counter.data()?.value);
    const agentCode = formatAgentCode(n);
    const chain: Chain = chainFromUpline(freshUp);
    const internal = placement.role === "internal";
    const doc: AgentDoc = {
      agentId: uid, agentCode, name: app.name, phone: app.phone, email: cleanEmail, idHash,
      idNumberMasked: maskIdNumber(app.idNumber), status: internal ? "active" : "applied", rank: placement.role, wardId: app.wardId,
      termsAcceptedAt: now, createdAt: now, phoneHash, emailHash, joinedVia: placement.via, downlineCount: 0,
      ...(app.countyId ? { countyId: app.countyId, constituencyId: app.constituencyId } : {}),
      ...chain,
      ...(placement.invite ? { invitedBy: placement.invite.inviterId } : {}),
      ...(internal ? { approvedAt: now } : {}),
    };
    tx.set(counterRef, { value: n, updatedAt: now });
    tx.create(idLock, { agentId: uid, createdAt: now });
    tx.create(phoneLock, { agentId: uid, createdAt: now });
    tx.create(emailLock, { agentId: uid, createdAt: now });
    tx.create(agentRef, doc);
    if (slot) writeSlot(tx, slot, now);
    if (freshUp) bumpDownline(tx, freshUp.agentId, 1);
    if (placement.invite) tx.update(col("invites").doc(placement.invite.code), { status: "used", usedBy: uid, usedAt: now });
    return { kind: "created" as const, agentCode, status: doc.status, role: placement.role };
  });

  if (result.kind === "duplicate") throw new DeskError("already_exists", DUPLICATE);
  if (result.kind === "created") {
    await audit({ action: "agent_applied", agentId: uid, meta: { agentCode: result.agentCode, wardId: app.wardId, role: result.role, via: placement.via, uplineId: up?.agentId ?? "internal" } });
    return { agentId: uid, status: result.status };
  }
  return { agentId: uid, status: result.status };
}
