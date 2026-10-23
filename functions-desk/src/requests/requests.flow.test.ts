/**
 * Requests: the sweep (pull once, reject malformed, crash-safe, public config, write-back retry) and the three callables.
 * Runs on the Firestore emulator when FIRESTORE_EMULATOR_HOST is set, otherwise on the in-memory double.
 * Product projects are separate stores; SMS is a test double.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import type { RequestsDeps } from "./deps.js";
import { createRequest, listRequests, updateRequest } from "./handlers.js";
import { buildPublicConfig, hashPublicConfig, type RequestDoc } from "./pure.js";
import { sweepRequests } from "./sweep.js";
import { cfgWith, productStore, rejects, seedAgent, seedTop } from "./fixtures.test.js";
import { useStore } from "./memstore.test.js";

const store = useStore();
const chama = productStore("chama");
const school = productStore("school");
const sms: { to: string; message: string }[] = [];
let clock = 0;
let cfg = cfgWith({ projects: { chama: "p-chama", school: "p-school" } });
let failProduct: string | undefined;
const deps: RequestsDeps = {
  now: () => clock, getConfig: async () => cfg,
  sendSms: async (to, message) => { sms.push({ to, message }); },
  productDb: (_c, product) => { if (failProduct === product) throw new DeskError("internal", "product down"); return (product === "chama" ? chama : school).db; },
};
beforeEach(async () => {
  await store.reset(); await chama.reset(); await school.reset();
  sms.length = 0; clock = 1_800_000_000_000; failProduct = undefined;
  cfg = cfgWith({ projects: { chama: "p-chama", school: "p-school" } });
});

const item = (o: Record<string, unknown> = {}) => ({
  kind: "support", status: "new", entityCode: "SMC-0042", entityName: "Umoja", requesterName: "Jane", requesterPhone: "0722000111",
  category: "sms", subject: "Credits", message: "Please help", targetDeskCodes: ["COG-0005"], createdAt: 1000, ...o,
});
const put = (s: typeof chama, id: string, o: Record<string, unknown> = {}) => s.db.collection("desk_requests").doc(id).set(item(o));
const outbox = async (s: typeof chama, id: string) => (await s.db.collection("desk_requests").doc(id).get()).data()!;

// ------------------------------------------------------------------ sweep
test("sweep pulls new items once, marks them pulled, and a second sweep pulls nothing", async () => {
  await put(chama, "a", { createdAt: 1 }); await put(chama, "b", { createdAt: 2 }); await put(school, "c", { entityCode: "SCH-0001", targetDeskCodes: [] });
  await put(chama, "done", { status: "pulled" });
  const s = await sweepRequests(deps, 60_000);
  assert.equal(s.pulled, 3); assert.equal(s.rejected, 0); assert.equal(s.failed, 0);
  const r = (await col("requests").doc("chama_SMC-0042_a").get()).data() as RequestDoc;
  assert.equal(r.source, "chama"); assert.equal(r.status, "new"); assert.deepEqual(r.targetDeskCodes, ["COG-0005"]); assert.equal(r.requesterPhone, "+254722000111");
  assert.equal(r.outboxId, "a"); assert.deepEqual(r.responses, []); assert.equal(r.createdAt, 1);
  assert.deepEqual(((await col("requests").doc("school_SCH-0001_c").get()).data() as RequestDoc).targetDeskCodes, ["COG-0000"]);
  assert.equal((await outbox(chama, "a")).status, "pulled"); assert.equal((await outbox(chama, "a")).pulledAt, clock);
  assert.equal((await col("requests").get()).size, 3);
  const again = await sweepRequests(deps, 60_000);
  assert.equal(again.pulled, 0); assert.equal((await col("requests").get()).size, 3);
});
test("malformed items are rejected with an error and never retried", async () => {
  await put(chama, "bad1", { requesterPhone: "nope" }); await put(chama, "bad2", { subject: "" }); await put(chama, "bad3", { kind: "payment" });
  const s = await sweepRequests(deps, 60_000);
  assert.equal(s.rejected, 3); assert.equal(s.pulled, 0); assert.equal((await col("requests").get()).size, 0);
  const o = await outbox(chama, "bad1"); assert.equal(o.status, "rejected"); assert.match(o.error, /phone/);
  assert.equal((await sweepRequests(deps, 60_000)).rejected, 0);
});
test("a crash between the two writes only causes an idempotent re-pull", async () => {
  await put(chama, "a");
  await sweepRequests(deps, 60_000);
  await chama.db.collection("desk_requests").doc("a").update({ status: "new" }); // the mark was lost
  await col("requests").doc("chama_SMC-0042_a").update({ status: "open", responses: [{ at: 1, byDeskCode: "COG-0005", text: "hi" }] });
  const s = await sweepRequests(deps, 60_000);
  assert.equal(s.pulled, 0); assert.equal(s.alreadyHad, 1); assert.equal((await outbox(chama, "a")).status, "pulled");
  const kept = (await col("requests").doc("chama_SMC-0042_a").get()).data() as RequestDoc;
  assert.equal(kept.status, "open"); assert.equal(kept.responses.length, 1); // create-only: the desk's work is never overwritten
});
test("at most 200 items per product per run; the rest come next run", async () => {
  for (let i = 0; i < 205; i++) await put(chama, `i${String(i).padStart(3, "0")}`, { createdAt: i + 1 });
  assert.equal((await sweepRequests(deps, 60_000)).pulled, 200);
  assert.equal((await sweepRequests(deps, 60_000)).pulled, 5);
});
test("the time budget stops the sweep early without losing anything", async () => {
  for (let i = 0; i < 5; i++) await put(chama, `i${i}`, { createdAt: i + 1 });
  let calls = 0;
  const slow: RequestsDeps = { ...deps, now: () => (calls++ > 12 ? clock + 10_000_000 : clock) };
  const s = await sweepRequests(slow, 1_000);
  assert.equal(s.timedOut, true); assert.ok(s.pulled < 5);
  await sweepRequests(deps, 60_000);
  assert.equal((await col("requests").get()).size, 5);
});
test("a product that is not connected, or is down, is skipped; the other still sweeps", async () => {
  await put(chama, "a"); await put(school, "b", { entityCode: "SCH-0001" });
  cfg = cfgWith({ projects: { chama: "", school: "p-school" } });
  assert.equal((await sweepRequests(deps, 60_000)).pulled, 1);
  cfg = cfgWith({ projects: { chama: "p-chama", school: "p-school" } }); failProduct = "school"; await put(school, "c", { entityCode: "SCH-0002" });
  const s = await sweepRequests(deps, 60_000);
  assert.equal(s.pulled, 1); assert.equal(s.failed, 1);
});
test("public config is pushed to each product only when its hash changes", async () => {
  const s1 = await sweepRequests(deps, 60_000);
  assert.equal(s1.configPushed, 2);
  const pushed = (await chama.db.collection("desk_public_config").doc("global").get()).data()!;
  assert.equal(hashPublicConfig(pushed as never), hashPublicConfig(buildPublicConfig(cfg, 0)));
  assert.equal(pushed.creditCostMinor, cfg.creditCostMinor);
  assert.ok((await col("counters").doc("publicconfig_chama").get()).data()!.hash);
  clock += 1000;
  assert.equal((await sweepRequests(deps, 60_000)).configPushed, 0);
  cfg = cfgWith({ projects: { chama: "p-chama", school: "p-school" }, smsShareOfMarginPct: 33 });
  assert.equal((await sweepRequests(deps, 60_000)).configPushed, 2);
  assert.equal((await chama.db.collection("desk_public_config").doc("global").get()).data()!.smsShareOfMarginPct, 33);
  // a product that is reconnected to a different project gets the config again
  cfg = cfgWith({ projects: { chama: "p-chama-2", school: "p-school" }, smsShareOfMarginPct: 33 });
  assert.equal((await sweepRequests(deps, 60_000)).configPushed, 1);
});

// ------------------------------------------------------------------ callables
const seedReq = async (id: string, o: Partial<RequestDoc> = {}) => {
  const r: RequestDoc = {
    id, source: "chama", entityCode: "SMC-0042", entityName: "Umoja", requesterName: "Jane", requesterPhone: "+254722000111", category: "sms",
    subject: "Credits", message: "Help", status: "new", targetDeskCodes: ["COG-0005"], responses: [], createdAt: 100, updatedAt: 100, outboxId: "ob-" + id, ...o,
  };
  await col("requests").doc(id).set(r);
  await chama.db.collection("desk_requests").doc(r.outboxId!).set(item({ status: "pulled" }));
  return r;
};

test("listRequests: only the desk's own, newest first, status filter, cursor, limit, newCount", async () => {
  await seedAgent("5"); await seedAgent("6");
  await seedReq("r1", { createdAt: 100 }); await seedReq("r2", { createdAt: 200, status: "open" }); await seedReq("r3", { createdAt: 300 });
  await seedReq("other", { createdAt: 250, targetDeskCodes: ["COG-0006"] }); await seedReq("multi", { createdAt: 50, targetDeskCodes: ["COG-0006", "COG-0005"] });
  const all = await listRequests("5", {});
  assert.deepEqual(all.requests.map((r) => r.id), ["r3", "r2", "r1", "multi"]); assert.equal(all.newCount, 3);
  assert.equal(JSON.stringify(all).includes("outboxId"), false);
  assert.deepEqual((await listRequests("5", { status: "open" })).requests.map((r) => r.id), ["r2"]);
  assert.deepEqual((await listRequests("5", { limit: 2 })).requests.map((r) => r.id), ["r3", "r2"]);
  assert.deepEqual((await listRequests("5", { before: 200 })).requests.map((r) => r.id), ["r1", "multi"]);
  assert.deepEqual((await listRequests("6", {})).requests.map((r) => r.id), ["other", "multi"]);
  await rejects(listRequests("5", { status: "weird" }), "invalid_argument"); await rejects(listRequests("5", { before: "x" }), "invalid_argument");
  await rejects(listRequests("nobody", {}), "permission_denied");
  await col("agents").doc("5").update({ status: "suspended" });
  await rejects(listRequests("5", {}), "permission_denied");
});
test("updateRequest: answering appends the reply, writes back to the product, texts the requester", async () => {
  await seedAgent("5"); await seedReq("r1");
  clock = 5000;
  assert.deepEqual(await updateRequest(deps, "5", { id: "r1", status: "answered", response: "Fixed, please check." }), { ok: true });
  const r = (await col("requests").doc("r1").get()).data() as RequestDoc;
  assert.equal(r.status, "answered"); assert.deepEqual(r.responses, [{ at: 5000, byDeskCode: "COG-0005", text: "Fixed, please check." }]); assert.equal(r.writeBackPending, false);
  const o = await outbox(chama, "ob-r1");
  assert.equal(o.deskStatus, "answered"); assert.deepEqual(o.responses, r.responses);
  assert.equal(sms.length, 1); assert.equal(sms[0].to, "+254722000111"); assert.match(sms[0].message, /Fixed, please check/);
  assert.equal((await col("audit").where("action", "==", "request_updated").get()).docs[0].data().meta.to, "answered");
  assert.equal(JSON.stringify((await col("audit").get()).docs.map((d) => d.data())).includes("Fixed, please"), false); // no message text in audit
});
test("updateRequest: state machine, reply rules, ownership", async () => {
  await seedAgent("5"); await seedAgent("6"); await seedReq("r1"); await seedReq("r2", { targetDeskCodes: ["COG-0006"] });
  await rejects(updateRequest(deps, "5", { id: "r1", status: "answered" }), "invalid_argument", /reply/);
  await rejects(updateRequest(deps, "5", { id: "r1", status: "answered", response: "x".repeat(1001) }), "invalid_argument");
  await rejects(updateRequest(deps, "5", { id: "r1", status: "new" }), "failed_precondition");
  await rejects(updateRequest(deps, "5", { id: "r2", status: "open" }), "not_found"); // not its request
  await rejects(updateRequest(deps, "5", { id: "nope", status: "open" }), "not_found");
  await updateRequest(deps, "5", { id: "r1", status: "open" });
  await rejects(updateRequest(deps, "5", { id: "r1", status: "open" }), "failed_precondition");
  await updateRequest(deps, "5", { id: "r1", status: "answered", response: "one" });
  await updateRequest(deps, "5", { id: "r1", status: "answered", response: "two" });
  assert.equal(((await col("requests").doc("r1").get()).data() as RequestDoc).responses.length, 2);
  await updateRequest(deps, "5", { id: "r1", status: "closed" });
  await rejects(updateRequest(deps, "5", { id: "r1", status: "answered", response: "late" }), "failed_precondition", /closed/);
  await rejects(updateRequest(deps, "5", { id: "r1", status: "open" }), "failed_precondition", /closed/);
  assert.equal((await outbox(chama, "ob-r1")).deskStatus, "closed");
});
test("updateRequest: the requester is texted at most once per hour per request", async () => {
  await seedAgent("5"); await seedReq("r1"); await seedReq("r2");
  clock = 1_000_000;
  await updateRequest(deps, "5", { id: "r1", status: "answered", response: "a" });
  clock += 10 * 60_000; await updateRequest(deps, "5", { id: "r1", status: "answered", response: "b" });
  await updateRequest(deps, "5", { id: "r2", status: "answered", response: "c" }); // a different request is not throttled
  assert.equal(sms.length, 2);
  clock += 60 * 60_000; await updateRequest(deps, "5", { id: "r1", status: "answered", response: "d" });
  assert.equal(sms.length, 3);
  await updateRequest(deps, "5", { id: "r1", status: "closed" }); // no reply, no SMS
  assert.equal(sms.length, 3);
});
test("updateRequest: a failed write-back is flagged and retried by the next sweep; an SMS failure does not fail the update", async () => {
  await seedAgent("5"); await seedReq("r1");
  failProduct = "chama";
  const failingSms: RequestsDeps = { ...deps, sendSms: async () => { throw new DeskError("internal", "sms down"); } };
  assert.deepEqual(await updateRequest(failingSms, "5", { id: "r1", status: "answered", response: "hello" }), { ok: true });
  const r = (await col("requests").doc("r1").get()).data() as RequestDoc;
  assert.equal(r.status, "answered"); assert.equal(r.writeBackPending, true);
  assert.equal((await outbox(chama, "ob-r1")).deskStatus, undefined);
  failProduct = undefined;
  const s = await sweepRequests(deps, 60_000);
  assert.equal(s.writeBacks, 1);
  assert.equal((await outbox(chama, "ob-r1")).deskStatus, "answered"); assert.equal(((await col("requests").doc("r1").get()).data() as RequestDoc).writeBackPending, false);
  assert.equal((await sweepRequests(deps, 60_000)).writeBacks, 0);
});
test("updateRequest on a pms or desk request needs no write-back", async () => {
  await seedAgent("5");
  await col("requests").doc("p1").set({ id: "p1", source: "pms", entityCode: "PMS-1", entityName: "Plot", requesterName: "T", requesterPhone: "+254722000111", category: "other", subject: "s", message: "m", status: "new", targetDeskCodes: ["COG-0005"], responses: [], createdAt: 1, updatedAt: 1 });
  await updateRequest(deps, "5", { id: "p1", status: "open" });
  assert.equal(((await col("requests").doc("p1").get()).data() as RequestDoc).writeBackPending, false);
});
test("createRequest: a desk asks COG-0000; validated, rate limited, audited; the top desk cannot ask itself", async () => {
  await seedTop(); await seedAgent("5", { name: "Wanjiru", phone: "+254713000111" });
  clock = 777;
  const { id } = await createRequest(deps, "5", { category: "other", subject: "Need help", message: "Customer dispute" });
  assert.match(id, /^desk_COG-0005_/);
  const r = (await col("requests").doc(id).get()).data() as RequestDoc;
  assert.equal(r.source, "desk"); assert.equal(r.entityCode, "COG-0005"); assert.deepEqual(r.targetDeskCodes, ["COG-0000"]); assert.equal(r.status, "new");
  assert.equal(r.requesterName, "Wanjiru"); assert.equal(r.requesterPhone, "+254713000111"); assert.equal(r.createdAt, 777);
  assert.equal((await col("audit").where("action", "==", "request_created").get()).size, 1);
  assert.equal((await listRequests("top1", {})).requests.length, 1);
  await rejects(createRequest(deps, "5", { category: "bogus", subject: "s", message: "m" }), "invalid_argument");
  await rejects(createRequest(deps, "5", { category: "other", subject: "", message: "m" }), "invalid_argument");
  await rejects(createRequest(deps, "5", { category: "other", subject: "s", message: "m".repeat(2001) }), "invalid_argument");
  await rejects(createRequest(deps, "top1", { category: "other", subject: "s", message: "m" }), "failed_precondition");
  for (let i = 0; i < 9; i++) await createRequest(deps, "5", { category: "other", subject: "s", message: "m" });
  await rejects(createRequest(deps, "5", { category: "other", subject: "s", message: "m" }), "failed_precondition", /too many/i);
  await seedAgent("6", { status: "suspended" });
  await rejects(createRequest(deps, "6", { category: "other", subject: "s", message: "m" }), "permission_denied");
});
