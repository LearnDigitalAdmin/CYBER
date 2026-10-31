// One-off: gives agents created BEFORE the network patch the phone/email lock documents and hashes the new join flow relies on, and
// reports legacy duplicates (two agents sharing a phone or email). Dry run by default: node scripts/backfill-desk-locks.mjs [--apply]
// Needs Application Default Credentials for the shared project (same as scripts/bootstrap-top-desk.mjs) and functions-desk dependencies
// installed (cd functions-desk && npm ci).
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// firebase-admin is installed in functions-desk (the repo root does not depend on it).
const require = createRequire(join(here, "..", "functions-desk", "package.json"));
const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const apply = process.argv.includes("--apply");
if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const salt = (await db.collection("desk_counters").doc("idsalt").get()).data()?.salt;
if (!salt) { console.error("No idsalt yet (no agent has ever applied). Nothing to backfill."); process.exit(0); }
const sha = (label, v) => createHash("sha256").update(`${salt}:${label}:${v}`).digest("hex");

const seen = new Map(); let created = 0, skipped = 0; const dupes = [];
for (const d of (await db.collection("desk_agents").get()).docs) {
  const a = d.data();
  if (!a.phone || !a.email) { skipped++; continue; }
  const phoneHash = sha("phone", a.phone), emailHash = sha("email", String(a.email).trim().toLowerCase());
  for (const [kind, h] of [["phone", phoneHash], ["email", emailHash]]) {
    if (seen.has(`${kind}:${h}`)) { dupes.push({ kind, a: seen.get(`${kind}:${h}`), b: a.agentCode }); continue; }
    seen.set(`${kind}:${h}`, a.agentCode);
  }
  if (!apply) continue;
  for (const [kind, h] of [["phone", phoneHash], ["email", emailHash]]) {
    try { await db.collection("desk_counters").doc(`${kind}hash_${h}`).create({ agentId: d.id, createdAt: Date.now(), backfilled: true }); created++; }
    catch (e) { if (e.code !== 6) throw e; }
  }
  await d.ref.update({ phoneHash, emailHash });
}
console.log({ apply, agents: seen.size, locksCreated: created, skippedMissingFields: skipped, duplicates: dupes });
if (dupes.length) console.log("Resolve duplicates by hand (suspend or close one account) - the locks keep the first one found.");
