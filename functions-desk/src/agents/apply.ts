import { randomBytes } from "node:crypto";
import type { ApplyAgentOut } from "../contract.js";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import type { AgentDoc } from "../types.js";
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

/**
 * Creates `desk_agents/{uid}` only if absent. The desk code comes from a transactional counter, and the salted ID hash is
 * locked in a create-only doc inside the same transaction so two accounts can never share one ID number.
 */
export async function applyAgent(uid: string, email: string | undefined, raw: unknown, now: number): Promise<ApplyAgentOut> {
  const app = validateApplication(raw);
  if (!email || !EMAIL.test(email)) throw new DeskError("invalid_argument", "Your account needs an email address before you can apply");
  const idHash = hashIdNumber(app.idNumber, await getIdSalt());

  const agentRef = col("agents").doc(uid);
  const counterRef = col("counters").doc("agents");
  const lockRef = col("counters").doc(`idhash_${idHash}`);

  const result = await db().runTransaction(async (tx) => {
    const existing = await tx.get(agentRef);
    if (existing.exists) return { kind: "existing" as const, status: (existing.data() as AgentDoc).status };
    const lock = await tx.get(lockRef);
    if (lock.exists) return { kind: "duplicate" as const };
    const counter = await tx.get(counterRef);
    const n = nextCounterValue(counter.data()?.value);
    const agentCode = formatAgentCode(n);
    const doc: AgentDoc = {
      agentId: uid, agentCode, name: app.name, phone: app.phone, email: email.trim(), idHash,
      idNumberMasked: maskIdNumber(app.idNumber), status: "applied", rank: "clerk", wardId: app.wardId,
      termsAcceptedAt: now, createdAt: now,
    };
    tx.set(counterRef, { value: n, updatedAt: now });
    tx.create(lockRef, { agentId: uid, createdAt: now });
    tx.create(agentRef, doc);
    return { kind: "created" as const, agentCode };
  });

  if (result.kind === "duplicate") {
    throw new DeskError("already_exists", "An application with this ID number already exists. Contact Samuhia support if this is a mistake.");
  }
  if (result.kind === "created") {
    await audit({ action: "agent_applied", agentId: uid, meta: { agentCode: result.agentCode, wardId: app.wardId } });
    return { agentId: uid, status: "applied" };
  }
  return { agentId: uid, status: result.status };
}
