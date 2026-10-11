/** desk_uploadDoc / desk_listMyDocs / desk_syncEmail through their handlers. Storage and the Auth lookup are test doubles. */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { col, db } from "../db.js";
import { DeskError } from "../errors.js";
import { syncEmail, type AccountDeps } from "../account/handlers.js";
import { rejects, seedAgent } from "../requests/fixtures.test.js";
import { useStore } from "../requests/memstore.test.js";
import type { DocsDeps } from "./deps.js";
import { listMyDocs, uploadDoc } from "./handlers.js";

const store = useStore();
const files = new Map<string, { bytes: Buffer; contentType: string }>();
let saveFails = false;
let clock = 0;
const deps: DocsDeps = {
  now: () => clock,
  store: {
    save: async (p, bytes, contentType) => { if (saveFails) throw new Error("bucket down"); files.set(p, { bytes, contentType }); },
    read: async (p) => { const f = files.get(p); if (!f) throw new Error("missing"); return f.bytes; },
  },
};
beforeEach(async () => { await store.reset(); files.clear(); saveFails = false; clock = 10_000; });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
const PDF = Buffer.from("%PDF-1.4 hello");
const up = (kind: string, bytes: Buffer, contentType: string) => ({ kind, contentType, dataBase64: bytes.toString("base64") });

test("upload stores the file privately at desk-docs/{uid}/{kind}, writes metadata and audits (no file content)", async () => {
  await seedAgent("5", { status: "applied" }, false);
  assert.deepEqual(await uploadDoc(deps, "5", up("id_front", PNG, "image/png")), { ok: true });
  assert.deepEqual(files.get("desk-docs/5/id_front"), { bytes: PNG, contentType: "image/png" });
  const m = (await col("docs").doc("5_id_front").get()).data()!;
  assert.deepEqual(m, { id: "5_id_front", uid: "5", kind: "id_front", contentType: "image/png", sizeBytes: PNG.length, path: "desk-docs/5/id_front", uploadedAt: 10_000 });
  const a = (await col("audit").where("action", "==", "doc_uploaded").get()).docs[0].data();
  assert.equal(a.agentId, "5"); assert.equal(a.meta.kind, "id_front"); assert.equal(a.meta.replaced, false); assert.equal(JSON.stringify(a).includes("iVBOR"), false);
});
test("replacing is allowed until the desk is certified", async () => {
  await seedAgent("5", { status: "training" }, false);
  await uploadDoc(deps, "5", up("selfie", PNG, "image/png"));
  clock = 20_000; await uploadDoc(deps, "5", up("selfie", PDF, "application/pdf"));
  assert.equal(files.get("desk-docs/5/selfie")!.contentType, "application/pdf");
  assert.equal((await col("docs").doc("5_selfie").get()).data()!.uploadedAt, 20_000);
  assert.equal((await col("audit").where("action", "==", "doc_uploaded").get()).docs.some((d) => d.data().meta.replaced === true), true);
  await col("agents").doc("5").update({ status: "certified" });
  await rejects(uploadDoc(deps, "5", up("selfie", PNG, "image/png")), "failed_precondition", /locked/);
  assert.equal(files.get("desk-docs/5/selfie")!.contentType, "application/pdf");
  await uploadDoc(deps, "5", up("id_back", PNG, "image/png")); // a missing document can still be added
});
test("suspended and closed desks cannot upload; strangers are refused; bad files change nothing", async () => {
  await seedAgent("5", { status: "suspended" }, false); await seedAgent("6", { status: "closed" }, false); await seedAgent("7", { status: "applied" }, false);
  await rejects(uploadDoc(deps, "5", up("selfie", PNG, "image/png")), "failed_precondition", /suspended/);
  await rejects(uploadDoc(deps, "6", up("selfie", PNG, "image/png")), "failed_precondition", /closed/);
  await rejects(uploadDoc(deps, "nobody", up("selfie", PNG, "image/png")), "permission_denied");
  await rejects(uploadDoc(deps, "7", up("selfie", PDF, "image/png")), "invalid_argument", /does not match/);
  await rejects(uploadDoc(deps, "7", up("selfie", Buffer.from("MZ..."), "image/png")), "invalid_argument");
  await rejects(uploadDoc(deps, "7", { kind: "selfie", contentType: "image/png" }), "invalid_argument");
  saveFails = true;
  await rejects(uploadDoc(deps, "7", up("selfie", PNG, "image/png")), "internal", /could not save/);
  assert.equal(files.size, 0); assert.equal((await col("docs").get()).size, 0);
});
test("listMyDocs returns one row per kind and never the file", async () => {
  await seedAgent("5", { status: "applied" }, false); await seedAgent("6", { status: "applied" }, false);
  await uploadDoc(deps, "5", up("id_back", PNG, "image/png")); await uploadDoc(deps, "6", up("selfie", PNG, "image/png"));
  const r = await listMyDocs("5");
  assert.deepEqual(r.docs, [{ kind: "id_front" }, { kind: "id_back", uploadedAt: 10_000, contentType: "image/png", sizeBytes: PNG.length }, { kind: "selfie" }]);
  await rejects(listMyDocs("nobody"), "permission_denied");
});

// ------------------------------------------------------------------ account
const acct = (u: { email?: string; emailVerified: boolean }): AccountDeps => ({ getAuthUser: async () => u });
test("syncEmail copies a verified Auth email to desk_agents and PAY's agents, audits, and is a no-op when equal", async () => {
  await seedAgent("5", { email: "old@x.co" }, { });
  const r = await syncEmail(acct({ email: "New@X.co", emailVerified: true }), "5");
  assert.deepEqual(r, { email: "new@x.co", changed: true });
  assert.equal((await col("agents").doc("5").get()).data()!.email, "new@x.co");
  assert.equal((await db().collection("agents").doc("5").get()).data()!.email, "new@x.co");
  assert.equal((await col("audit").where("action", "==", "email_synced").get()).size, 1);
  assert.equal(JSON.stringify((await col("audit").get()).docs.map((d) => d.data())).includes("new@x.co"), false); // no address in audit
  assert.deepEqual(await syncEmail(acct({ email: "new@x.co", emailVerified: true }), "5"), { email: "new@x.co", changed: false });
  assert.equal((await col("audit").where("action", "==", "email_synced").get()).size, 1);
});
test("syncEmail: unverified or missing email, non-agents, and a missing PAY profile", async () => {
  await seedAgent("5", { email: "old@x.co" }, false);
  await rejects(syncEmail(acct({ email: "n@x.co", emailVerified: false }), "5"), "failed_precondition", /Verify/);
  await rejects(syncEmail(acct({ emailVerified: true }), "5"), "failed_precondition", /no email/);
  await rejects(syncEmail(acct({ email: "n@x.co", emailVerified: true }), "ghost"), "permission_denied");
  assert.equal((await col("agents").doc("5").get()).data()!.email, "old@x.co");
  assert.equal((await syncEmail(acct({ email: "n@x.co", emailVerified: true }), "5")).changed, true); // PAY profile absent: only desk copy updated
  assert.equal((await db().collection("agents").doc("5").get()).exists, false);
  const failing: AccountDeps = { getAuthUser: async () => { throw new DeskError("internal", "auth down"); } };
  await rejects(syncEmail(failing, "5"), "internal");
});
