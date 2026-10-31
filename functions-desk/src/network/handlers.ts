import { FieldValue } from "firebase-admin/firestore";
import type {
  AgentStatus, NetDashboardOut, NetDecideOut, NetInviteOut, NetMember, NetMonthStat, NetOptionsOut, NetPending, NetTeamOut, Rank,
} from "../contract.js";
import { DOC_KINDS } from "../contract.js";
import { record } from "../connectors/input.js";
import { col, db, getConfig } from "../db.js";
import { docMetaId } from "../docs/pure.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireActiveAgent } from "../kernel/agents.js";
import { sendSms } from "../kernel/sms.js";
import { normalizeKenyaPhone } from "../paystack/phone.js";
import { endSessions } from "../topdesk/handlers.js";
import type { AgentDoc, InviteDoc, StatsDoc } from "../types.js";
import { cascadeChain, releaseAgentSlot } from "./admin.js";
import { bumpDownline, findAgentByCode, loadHierarchy, optionsFor, slotRef } from "./hierarchy.js";
import { phoneHashOf, getIdSalt } from "../agents/apply.js";
import {
  canDecide, canInvite, chainFromUpline, decisionMove, monthOf, newInviteCode, nextMonth, prevMonth, resolveGeo, roleForUplineCode, type Chain,
} from "./pure.js";

const DESK_CODE = /^COG-\d{4,}$/;
const codeInput = (v: unknown): string => {
  const c = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (!DESK_CODE.test(c)) throw new DeskError("invalid_argument", "Enter a desk code like COG-0123");
  return c;
};
const maskPhone = (p: string): string => (p.length > 7 ? `${p.slice(0, 6)}***${p.slice(-3)}` : "***");
const FIELDS: ReadonlyArray<"seniorId" | "leadId" | "adminId" | "uplineId"> = ["uplineId", "seniorId", "leadId", "adminId"];
const statsId = (agentId: string, month: string) => `${agentId}_${month}`;

// ------------------------------------------------------------------ options (what a joiner may pick)
export async function netOptions(uid: string, raw: unknown): Promise<NetOptionsOut> {
  void uid;
  const d = record(raw);
  const geo = resolveGeo(String(d.county ?? ""), String(d.constituency ?? ""), String(d.ward ?? ""));
  const h = await loadHierarchy(geo);
  return { defaultRole: "clerk", roles: optionsFor(h, await getConfig()) };
}

// ------------------------------------------------------------------ invite
export async function netInvite(uid: string, raw: unknown, now: number): Promise<NetInviteOut> {
  const actor = await requireActiveAgent(uid);
  const d = record(raw);
  const role = d.role;
  if (role !== "clerk" && role !== "senior" && role !== "lead" && role !== "admin") throw new DeskError("invalid_argument", "Choose the role to invite");
  if (!canInvite(actor.rank, role)) throw new DeskError("permission_denied", "You cannot invite that role");
  const phone = normalizeKenyaPhone(typeof d.phone === "string" ? d.phone : "");
  const name = typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 60) : undefined;
  if (phone === actor.phone) throw new DeskError("permission_denied", "You cannot invite yourself");

  const cfg = await getConfig();
  const salt = await getIdSalt();
  const [dupAgent, lock, today] = await Promise.all([
    col("agents").where("phone", "==", phone).limit(1).get(),
    col("counters").doc(`phonehash_${phoneHashOf(phone, salt)}`).get(),
    col("invites").where("inviterId", "==", uid).where("createdAt", ">=", now - 86_400_000).count().get(),
  ]);
  if (!dupAgent.empty || lock.exists) throw new DeskError("already_exists", "That number already belongs to a desk agent");
  if (today.data().count >= cfg.network.invitesPerDay) throw new DeskError("failed_precondition", "You have reached today's invite limit. Try again tomorrow.");
  const open = await col("invites").where("phone", "==", phone).where("status", "==", "open").where("expiresAt", ">", now).limit(1).get();
  if (!open.empty) throw new DeskError("already_exists", "That number already has an open invite");

  const expiresAt = now + cfg.network.inviteTtlDays * 86_400_000;
  let code = "";
  for (let i = 0; i < 5 && !code; i++) {
    const c = newInviteCode();
    const inv: InviteDoc = { code: c, inviterId: uid, inviterCode: actor.agentCode, role, phone, phoneHash: phoneHashOf(phone, salt), ...(name ? { name } : {}), status: "open", createdAt: now, expiresAt };
    try { await col("invites").doc(c).create(inv); code = c; } catch (err) { if ((err as { code?: number }).code !== 6) throw err; }
  }
  if (!code) throw new DeskError("internal", "Could not create an invite. Please try again.");

  let smsSent = true;
  try {
    await sendSms(phone, `${actor.name.split(" ")[0]} (${actor.agentCode}) invited you to join Samuhia Desk as a ${role}. Your invite code is ${code}, valid ${cfg.network.inviteTtlDays} days. Open Samuhia Desk and choose Join, then enter it. Approval is still required.`);
  } catch (err) {
    smsSent = false;
    console.error("invite sms failed", err);
  }
  await audit({ action: "net_invite", agentId: uid, meta: { role, code, smsSent } });
  return { inviteCode: code, expiresAt, smsSent };
}

// ------------------------------------------------------------------ approve / activate / reject / suspend / reinstate / assign
const inScope = (up: AgentDoc, t: Pick<AgentDoc, "countyId" | "constituencyId" | "wardId">): boolean => {
  if (!up.countyId) return true;
  if (!t.countyId) return false;
  return up.rank === "senior" ? up.wardId === t.wardId : up.rank === "lead" ? up.constituencyId === t.constituencyId : up.rank === "admin" ? up.countyId === t.countyId : true;
};

export async function netDecide(uid: string, raw: unknown, now: number): Promise<NetDecideOut> {
  const actor = await requireActiveAgent(uid);
  const d = record(raw);
  const code = codeInput(d.deskCode);
  const action = typeof d.action === "string" ? d.action : "";
  const reason = typeof d.reason === "string" ? d.reason.trim().slice(0, 200) : "";
  const target = await findAgentByCode(code);
  if (!target) throw new DeskError("not_found", `No desk with code ${code}`);
  const allowed = canDecide(actor, target, action);
  if (!allowed.ok) throw new DeskError("permission_denied", allowed.message);
  const targetRef = col("agents").doc(target.agentId);

  if (action === "assign") return assign(actor, target, codeInput(d.uplineCode), now);

  const move = decisionMove(target.status, action);
  if (!move.ok) throw new DeskError("failed_precondition", move.message);
  const contractRef = typeof d.contractRef === "string" ? d.contractRef.trim().slice(0, 80) : "";
  if (action === "approve" && target.rank === "admin" && !contractRef) throw new DeskError("invalid_argument", "Enter the signed contract reference for this admin agent");
  if ((action === "reject" || action === "suspend") && !reason) throw new DeskError("invalid_argument", "Give a short reason");

  await db().runTransaction(async (tx) => {
    const reads = await Promise.all([
      tx.get(targetRef), ...DOC_KINDS.map((k) => tx.get(col("docs").doc(docMetaId(target.agentId, k)))), tx.get(db().collection("agents").doc(target.agentId)),
    ]);
    const cur = reads[0].data() as AgentDoc | undefined;
    if (!cur || cur.status !== target.status) throw new DeskError("failed_precondition", "This desk just changed. Refresh and try again.");
    if (move.to === "active") {
      if (!reads.slice(1, 1 + DOC_KINDS.length).every((s) => s.exists)) throw new DeskError("failed_precondition", "All three registration documents must be uploaded before activating this desk");
      const pay = (reads[1 + DOC_KINDS.length].data()?.paymentInfo ?? {}) as { accountId?: string };
      if (!pay.accountId) throw new DeskError("failed_precondition", "This desk has no ready main payout account yet");
    }
    const patch: Record<string, unknown> = { status: move.to, statusReason: reason };
    if (action === "approve") { patch.approvedBy = actor.agentId; patch.approvedAt = now; if (contractRef) patch.contractRef = contractRef; }
    if (move.to === "closed") patch.closedAt = now;
    tx.update(targetRef, patch);
  });
  if (move.to !== "active") await endSessions(target.agentId, now);
  if (move.to === "closed") await releaseAgentSlot(target.agentId, now);
  await audit({ action: `net_${action}`, agentId: uid, meta: { deskCode: code, from: target.status, to: move.to, reason } });
  return { ok: true, status: move.to };
}

async function assign(actor: AgentDoc, target: AgentDoc, uplineCode: string, now: number): Promise<NetDecideOut> {
  if (target.status === "closed") throw new DeskError("failed_precondition", "This desk is closed");
  const up = await findAgentByCode(uplineCode);
  if (!up || up.status !== "active") throw new DeskError("not_found", "We could not find an active agent with that code");
  if (up.agentId === target.agentId) throw new DeskError("invalid_argument", "An agent cannot be their own upline");
  if (up.rank !== "internal" && roleForUplineCode(up.rank) !== target.rank) throw new DeskError("failed_precondition", `A ${up.rank} cannot be the upline of a ${target.rank}`);
  if (up.rank === "internal" && target.rank !== "clerk") throw new DeskError("failed_precondition", "Only clerks sit directly under internal");
  if (!inScope(up, target)) throw new DeskError("failed_precondition", "That agent works in a different area");
  if (actor.rank === "admin" && up.rank !== "internal" && up.countyId !== actor.countyId) throw new DeskError("permission_denied", "That agent is outside your county");
  if (up.phone === target.phone || up.idHash === target.idHash) throw new DeskError("permission_denied", "An agent cannot be placed under their own details");
  // never create a loop: the new upline must not be below the target
  if ([up.seniorId, up.leadId, up.adminId].includes(target.agentId)) throw new DeskError("failed_precondition", "That would place an agent under their own team");

  const chain: Chain = up.rank === "internal" ? {} : chainFromUpline(up);
  const updated: AgentDoc = { ...target, ...Object.fromEntries(FIELDS.map((k) => [k, chain[k]])) } as AgentDoc;
  await db().runTransaction(async (tx) => {
    const ref = col("agents").doc(target.agentId);
    const cur = (await tx.get(ref)).data() as AgentDoc | undefined;
    if (!cur) throw new DeskError("not_found", "Desk not found");
    const patch: Record<string, unknown> = {};
    for (const k of FIELDS) patch[k] = chain[k] ?? FieldValue.delete();
    if (cur.uplineId && cur.uplineId !== up.agentId) bumpDownline(tx, cur.uplineId, -1);
    if (up.rank !== "internal" && cur.uplineId !== up.agentId) bumpDownline(tx, up.agentId, 1);
    tx.update(ref, patch);
  });
  const moved = await cascadeChain({ agentId: target.agentId, rank: target.rank, leadId: updated.leadId, adminId: updated.adminId });
  await audit({ action: "net_assign", agentId: actor.agentId, meta: { deskCode: target.agentCode, upline: uplineCode, cascaded: moved } });
  return { ok: true, status: target.status };
}

// ------------------------------------------------------------------ team list
function scopeQuery(actor: AgentDoc): FirebaseFirestore.Query {
  const base = col("agents") as FirebaseFirestore.Query;
  switch (actor.rank) {
    case "senior": return base.where("seniorId", "==", actor.agentId);
    case "lead": return base.where("leadId", "==", actor.agentId);
    case "admin":
      if (!actor.countyId) return base.where("adminId", "==", actor.agentId);
      return base.where("countyId", "==", actor.countyId);
    case "internal": return base;
    default: throw new DeskError("permission_denied", "Clerks do not have a team");
  }
}

export async function netTeam(uid: string, raw: unknown, now: number): Promise<NetTeamOut> {
  const actor = await requireActiveAgent(uid);
  const d = record(raw);
  let q = scopeQuery(actor);
  const status = typeof d.status === "string" ? (d.status as AgentStatus) : undefined;
  const rank = typeof d.rank === "string" ? (d.rank as Rank) : undefined;
  if (status) q = q.where("status", "==", status);
  if (rank) q = q.where("rank", "==", rank);
  q = q.orderBy("createdAt", "desc");
  if (typeof d.cursor === "number") q = q.startAfter(d.cursor);
  const search = typeof d.search === "string" ? d.search.trim().toLowerCase() : "";
  const snap = await q.limit(26).get();
  let docs = snap.docs.map((x) => x.data() as AgentDoc).filter((a) => a.agentId !== actor.agentId && (actor.rank === "internal" || (a.rank !== "admin" && a.rank !== "internal")));
  const more = snap.size > 25;
  docs = docs.slice(0, 25);
  if (search) docs = docs.filter((a) => `${a.agentCode} ${a.name} ${a.phone}`.toLowerCase().includes(search));
  const month = monthOf(now);
  const stats = docs.length ? await db().getAll(...docs.map((a) => col("stats").doc(statsId(a.agentId, month)))) : [];
  const owned = await Promise.all(docs.map((a) => col("customers").where("ownerAgentId", "==", a.agentId).count().get()));
  const byId = new Map<string, AgentDoc>();
  for (const a of docs) byId.set(a.agentId, a);
  const members: NetMember[] = docs.map((a, i) => {
    const s = (stats[i]?.data() ?? {}) as Partial<StatsDoc>;
    const up = a.uplineId ? byId.get(a.uplineId) : undefined;
    return {
      deskCode: a.agentCode, name: a.name, phoneMasked: maskPhone(a.phone), rank: a.rank, status: a.status, wardId: a.wardId,
      ...(up ? { uplineCode: up.agentCode } : {}), createdAt: a.createdAt, monthNetMinor: s.netMinor ?? 0, monthPayments: s.payments ?? 0, customers: owned[i].data().count,
    };
  });
  const last = snap.docs[Math.min(24, snap.docs.length - 1)]?.data() as AgentDoc | undefined;
  return { members, ...(more && last ? { nextCursor: last.createdAt } : {}) };
}

// ------------------------------------------------------------------ dashboard
const count = async (q: FirebaseFirestore.Query): Promise<number> => (await q.count().get()).data().count;
const nextSecond = (now: number): string => {
  const m = monthOf(now);
  const day = new Date(now + 3 * 3_600_000).getUTCDate();
  return `${day < 2 ? m : nextMonth(m)}-02`;
};

export async function netDashboard(uid: string, now: number): Promise<NetDashboardOut> {
  const snap = await col("agents").doc(uid).get();
  if (!snap.exists) throw new DeskError("permission_denied", "You are not a Samuhia Desk agent");
  const me = snap.data() as AgentDoc;
  const cfg = await getConfig();
  const month = monthOf(now);
  const months: string[] = [month]; for (let i = 0; i < 5; i++) months.push(prevMonth(months[i]));
  const statDocs = await db().getAll(...months.map((m) => col("stats").doc(statsId(uid, m))));
  const stats: NetMonthStat[] = statDocs.map((s, i) => {
    const x = (s.data() ?? {}) as Partial<StatsDoc>;
    return {
      month: months[i], payments: x.payments ?? 0, netMinor: x.netMinor ?? 0, commissionMinor: x.commissionMinor ?? 0, overrideMinor: x.overrideMinor ?? 0,
      incentiveMinor: x.incentiveMinor ?? 0, newCustomers: x.newCustomers ?? 0, activeCustomers: x.activeCustomers ?? 0,
      teamNetMinor: x.teamNetMinor ?? 0, teamPayments: x.teamPayments ?? 0, teamNewCustomers: x.teamNewCustomers ?? 0,
    };
  });
  const own = col("customers").where("ownerAgentId", "==", uid);
  const [owned, paidNow, paidPrev] = await Promise.all([
    count(own), count(own.where("paidPeriods", "array-contains", month)), count(own.where("paidPeriods", "array-contains", prevMonth(month))),
  ]);

  const out: NetDashboardOut = {
    role: me.rank, status: me.status, deskCode: me.agentCode, month, stats,
    customers: { owned, paidThisMonth: paidNow, paidLastMonth: paidPrev }, pending: [],
    payout: { carryMinor: (statDocs[1]?.data() as StatsDoc | undefined)?.carryOutMinor ?? 0, minPayoutMinor: cfg.network.minPayoutMinor, nextRun: nextSecond(now) },
    rules: { overridePct: me.rank === "senior" ? cfg.network.overridePct.senior : me.rank === "lead" ? cfg.network.overridePct.lead : null, incentives: {
      acquisitionMinor: cfg.incentives.acquisitionMinor, activationMinor: cfg.incentives.activationMinor, retention6Minor: cfg.incentives.retention6Minor,
      retention12Minor: cfg.incentives.retention12Minor, loyaltyMonthlyMinor: cfg.incentives.loyaltyMonthlyMinor, loyaltyMinStreak: cfg.incentives.loyaltyMinStreak,
      activeBookTiers: cfg.incentives.activeBookTiers, qualityMinor: cfg.incentives.qualityMinor, qualityMinConfirmed: cfg.incentives.qualityMinConfirmed,
    } },
  };
  const up = me.uplineId ? ((await col("agents").doc(me.uplineId).get()).data() as AgentDoc | undefined) : undefined;
  if (up) out.upline = { name: up.name, deskCode: up.agentCode, rank: up.rank };

  if (me.rank === "senior" || me.rank === "lead" || me.rank === "admin" || me.rank === "internal") {
    const base = scopeQuery(me);
    const inStatus = (s: AgentStatus[]) => base.where("status", "in", s);
    const [clerks, seniors, leads, admins, active, suspended, pendingApproval] = await Promise.all([
      count(base.where("rank", "==", "clerk")), count(base.where("rank", "==", "senior")), count(base.where("rank", "==", "lead")), count(base.where("rank", "==", "admin")),
      count(base.where("status", "==", "active")), count(base.where("status", "==", "suspended")), count(inStatus(["applied"])),
    ]);
    out.team = { clerks, seniors, leads, admins, active, suspended, pendingApproval };
  }
  if (me.rank === "admin" || me.rank === "internal") {
    const pend = await scopeQuery(me).where("status", "==", "applied").orderBy("createdAt", "desc").limit(25).get();
    out.pending = pend.docs.map((x) => x.data() as AgentDoc).filter((a) => me.rank === "internal" || (a.rank !== "admin" && a.rank !== "internal")).map((a): NetPending => ({
      deskCode: a.agentCode, name: a.name, rank: a.rank, wardId: a.wardId, createdAt: a.createdAt,
    }));
  }
  if (me.countyId || me.rank === "senior" || me.rank === "lead") {
    const [s, l] = await Promise.all([slotRef("senior", me.wardId).get(), me.constituencyId ? slotRef("lead", me.constituencyId).get() : Promise.resolve(undefined)]);
    out.slots = { seniorsInWard: (s.data()?.used as number | undefined) ?? 0, seniorsMax: cfg.network.seniorsPerWard, leadsInConstituency: (l?.data()?.used as number | undefined) ?? 0, leadsMax: cfg.network.leadsPerConstituency };
  }
  if (me.rank === "internal") {
    const g = (await col("counters").doc(`gov_${prevMonth(month)}`).get()).data();
    if (g) out.margin = { month: prevMonth(month), baseMinor: g.baseMinor, costMinor: g.costMinor, retainedPct: g.retainedPct, floorPct: cfg.network.platformFloorPct, scale: (g.scaleBps ?? 10000) / 10000 };
  }
  return out;
}
