import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { col } from "../db.js";
import { applyAgent } from "./apply.js";
import { rejects } from "../connectors/harness.test.js";
import type { AgentDoc } from "../types.js";

const opts = { skip: !emulatorEnabled };
const form = (o = {}) => ({ name: "Jane Wanjiru", phone: "0712345678", idNumber: "12345678", wardId: "w1", ...o });
beforeEach(async () => { if (emulatorEnabled) await clearFirestore(); });

test("apply creates an applied clerk with COG-0001, masked ID and an audit row", opts, async () => {
  const out = await applyAgent("u1", "jane@x.co", form(), 1000);
  assert.deepEqual(out, { agentId: "u1", status: "applied" });
  const a = (await col("agents").doc("u1").get()).data() as AgentDoc;
  assert.equal(a.agentCode, "COG-0001"); assert.equal(a.rank, "clerk"); assert.equal(a.status, "applied");
  assert.equal(a.idNumberMasked, "****5678"); assert.equal(a.termsAcceptedAt, 1000); assert.equal(a.email, "jane@x.co");
  assert.equal(a.phone, "+254712345678"); assert.match(a.idHash, /^[0-9a-f]{64}$/); assert.ok(!JSON.stringify(a).includes("12345678"));
  const audits = await col("audit").where("action", "==", "agent_applied").get();
  assert.equal(audits.size, 1);
});
test("apply is idempotent: no second doc, no second code, no changes", opts, async () => {
  await applyAgent("u1", "jane@x.co", form(), 1000);
  const again = await applyAgent("u1", "jane@x.co", form({ name: "Someone Else" }), 2000);
  assert.deepEqual(again, { agentId: "u1", status: "applied" });
  const a = (await col("agents").doc("u1").get()).data() as AgentDoc;
  assert.equal(a.name, "Jane Wanjiru");
  assert.equal((await col("counters").doc("agents").get()).data()?.value, 1);
  assert.equal((await col("audit").where("action", "==", "agent_applied").get()).size, 1);
});
test("codes are sequential and COG-0000 is never issued", opts, async () => {
  await applyAgent("u1", "a@x.co", form(), 1);
  await applyAgent("u2", "b@x.co", form({ idNumber: "87654321" }), 2);
  assert.equal(((await col("agents").doc("u2").get()).data() as AgentDoc).agentCode, "COG-0002");
  const all = await col("agents").get();
  assert.ok(all.docs.every((d) => d.data().agentCode !== "COG-0000"));
});
test("concurrent applications get distinct codes", opts, async () => {
  await Promise.all(Array.from({ length: 6 }, (_, i) => applyAgent(`c${i}`, `c${i}@x.co`, form({ idNumber: `1000000${i}` }), 1)));
  const codes = (await col("agents").get()).docs.map((d) => d.data().agentCode);
  assert.equal(new Set(codes).size, 6);
});
test("a second agent with the same ID number is refused", opts, async () => {
  await applyAgent("u1", "a@x.co", form(), 1);
  await rejects(applyAgent("u2", "b@x.co", form(), 2), "already_exists");
  assert.ok(!(await col("agents").doc("u2").get()).exists);
});
test("same ID applied by two accounts at once creates exactly one agent", opts, async () => {
  const r = await Promise.allSettled([applyAgent("p1", "a@x.co", form(), 1), applyAgent("p2", "b@x.co", form(), 1)]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await col("agents").get()).size, 1);
});
test("email is required and validation errors create nothing", opts, async () => {
  await rejects(applyAgent("u1", undefined, form(), 1), "invalid_argument", /email/i);
  await rejects(applyAgent("u1", "a@x.co", form({ idNumber: "123" }), 1), "invalid_argument");
  await rejects(applyAgent("u1", "a@x.co", form({ phone: "12" }), 1), "invalid_argument");
  assert.equal((await col("agents").get()).size, 0);
});
