#!/usr/bin/env node
/**
 * Creates the company's top desk (COG-0000) for an EXISTING Firebase Auth user.
 *
 *   node scripts/bootstrap-top-desk.mjs <uid> <phone>
 *
 * Uses the Admin SDK against the project selected by your credentials (GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth
 * application-default login`, plus GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT or FIRESTORE_EMULATOR_HOST for an emulator).
 * Requires: the Auth user exists, has a VERIFIED @samuhia.co.ke email. Refuses if COG-0000 already exists.
 * Also makes sure desk_counters/agents exists so the first ordinary desk is COG-0001 (the counter holds the LAST issued number).
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// firebase-admin is installed in functions-desk (the repo root does not depend on it).
const require = createRequire(join(here, "..", "functions-desk", "package.json"));
const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const TOP_CODE = "COG-0000";
const DOMAIN = "samuhia.co.ke";
const fail = (msg) => { console.error(`ERROR: ${msg}`); process.exit(1); };

/** Same rules as the backend's normalizeKenyaPhone: any common Kenyan format -> +2547XXXXXXXX / +2541XXXXXXXX. */
function normalizeKenyaPhone(raw) {
  let p = String(raw).replace(/[\s()-]/g, "");
  if (p.startsWith("+254")) p = p.slice(1);
  else if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (/^[17]\d{8}$/.test(p)) p = "254" + p;
  if (!/^254[17]\d{8}$/.test(p)) return null;
  return "+" + p;
}

const [uid, phoneRaw, ...extra] = process.argv.slice(2);
if (!uid || !phoneRaw || extra.length > 0) fail("usage: node scripts/bootstrap-top-desk.mjs <uid> <phone>");
const phone = normalizeKenyaPhone(phoneRaw);
if (!phone) fail("the phone number is not a valid Kenyan number");

if (getApps().length === 0) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId: projectId || "demo-desk" } : { credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
}
const db = getFirestore();

let user;
try { user = await getAuth().getUser(uid); } catch { fail(`no Firebase Auth user with uid ${uid}`); }
const email = (user.email || "").trim().toLowerCase();
if (!new RegExp(`^[^@\\s]+@${DOMAIN.replace(/\./g, "\\.")}$`).test(email)) fail(`the Auth user's email must be @${DOMAIN} (found ${email || "none"})`);
if (!user.emailVerified) fail("the Auth user's email is not verified yet");

const agents = db.collection("desk_agents");
const counterRef = db.collection("desk_counters").doc("agents");
const now = Date.now();

const result = await db.runTransaction(async (tx) => {
  const existing = await tx.get(agents.where("agentCode", "==", TOP_CODE).limit(1));
  if (!existing.empty) return { kind: "exists", uid: existing.docs[0].id };
  const byUid = await tx.get(agents.doc(uid));
  if (byUid.exists) return { kind: "uid-taken", code: byUid.data().agentCode };
  const counter = await tx.get(counterRef);
  tx.set(agents.doc(uid), {
    agentId: uid, agentCode: TOP_CODE, name: user.displayName || email.split("@")[0], phone, email,
    idHash: `top-desk:${uid}`, idNumberMasked: "n/a", status: "active", rank: "lead", wardId: "hq", termsAcceptedAt: now, createdAt: now,
  });
  // The counter holds the LAST issued number: 0 means the next desk is COG-0001. An existing counter is never lowered.
  if (!counter.exists) tx.set(counterRef, { value: 0, updatedAt: now });
  return { kind: "created", counterCreated: !counter.exists };
});

if (result.kind === "exists") fail(`${TOP_CODE} already exists (uid ${result.uid}). Nothing was changed.`);
if (result.kind === "uid-taken") fail(`this uid already has a desk record (${result.code}). Nothing was changed.`);
await db.collection("desk_audit").add({ action: "top_desk_bootstrapped", agentId: uid, meta: { agentCode: TOP_CODE }, at: now });
console.log(`Created ${TOP_CODE} for ${email} (${uid}), status active, rank lead.`);
console.log(result.counterCreated ? "desk_counters/agents created: the first ordinary desk will be COG-0001." : "desk_counters/agents already existed and was left unchanged.");
