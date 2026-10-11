/**
 * Payouts end to end: listing, OTP + summary gating, the daily cap (including concurrent payouts), idempotency, failure and
 * reversal handling, the reconciler and the monthly support payables. Paystack is a test double behind TransferClient.
 * Runs on the Firestore emulator when FIRESTORE_EMULATOR_HOST is set, otherwise on the in-memory double.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG, type DeskConfig } from "../config.js";
import { summaryTopPayout } from "../contract.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import { rejects, seedAgent, seedLedger, seedTop, seedTopOtp, topAuth, eid, cfgWith } from "../requests/fixtures.test.js";
import { useStore } from "../requests/memstore.test.js";
import type { TransferClient, TransferLookup } from "./paystack.js";
import { OTP_SETUP_MESSAGE, topListPayables, topPayout, type PayoutDeps } from "./payout.js";
import { nairobiDayKey, payoutReference } from "./pure.js";
import { reconcilePayouts } from "./reconcile.js";
import { prepareSupportPayables } from "./support.js";

const store = useStore();

class FakePaystack implements TransferClient {
  recipients: { name: string; accountNumberLocal: string }[] = [];
  initiated: { amountMinor: number; recipientCode: string; reference: string; reason: string }[] = [];
  transfers = new Map<string, { status: string; amountMinor: number; transferCode: string }>();
  initiateStatus = "success";
  failRecipient = false;
  failInitiate: "none" | "reject" | "timeout-but-created" | "timeout-not-created" = "none";
  hideAfterInitiate = false; // verify says "not found" even after creating (simulates lag)
  async createRecipient(i: { name: string; accountNumberLocal: string }) {
    if (this.failRecipient) throw new DeskError("payment_failed", "Recipient rejected");
    this.recipients.push(i); return { recipientCode: `RCP_${this.recipients.length}` };
  }
  async initiate(i: { amountMinor: number; recipientCode: string; reference: string; reason: string }) {
    if (this.transfers.has(i.reference)) throw new DeskError("payment_failed", "Transfer reference already used");
    this.initiated.push(i);
    if (this.failInitiate === "reject") throw new DeskError("payment_failed", "Your balance is not enough to fulfil this request");
    if (this.failInitiate === "timeout-not-created") throw new DeskError("payment_failed", "Paystack did not respond");
    this.transfers.set(i.reference, { status: this.initiateStatus === "otp" ? "otp" : this.initiateStatus, amountMinor: i.amountMinor, transferCode: `TRF_${this.initiated.length}` });
    if (this.failInitiate === "timeout-but-created") throw new DeskError("payment_failed", "Paystack did not respond");
    return { status: this.initiateStatus, transferCode: `TRF_${this.initiated.length}` };
  }
  async verify(reference: string): Promise<TransferLookup> {
    const t = this.transfers.get(reference);
    if (!t || this.hideAfterInitiate) return { found: false };
    return { found: true, status: t.status, amountMinor: t.amountMinor, transferCode: t.transferCode, reference };
  }
}

let ps: FakePaystack;
let clock: number;
let cfg: DeskConfig;
const deps = (): PayoutDeps => ({ now: () => clock, getConfig: async () => cfg, transfers: ps });
beforeEach(async () => {
  await store.reset();
  ps = new FakePaystack(); clock = Date.now(); cfg = cfgWith();
  await seedTop();
});

const E1 = eid(1), E2 = eid(2), E3 = eid(3);
const dayDoc = async () => (await col("counters").doc(`payout_day_${nairobiDayKey(clock)}`).get()).data();
const row = async (id: string) => (await col("ledger").doc(id).get()).data()!;
const pay = async (ids: string[], total: number, desks: number, otpId = "p1", o: { otp?: string } = {}) => {
  await seedTopOtp(otpId, "payout", summaryTopPayout(total, desks));
  return topPayout(deps(), topAuth(), { entryIds: ids, actionId: otpId, otp: o.otp ?? "123456" });
};

// ------------------------------------------------------------------ happy path
test("payout: payable -> processing -> paid after Paystack confirms; recipient created once for the desk's M-Pesa number", async () => {
  await seedAgent("5", {}, { settlementBank: "mpesa", accountNumber: "0722 000 111" });
  await seedLedger(E1, "5", { amountMinor: 200_000 });
  await seedLedger(E2, "5", { amountMinor: 50_000, kind: "support" });
  const r = await pay([E1, E2], 250_000, 1);
  assert.deepEqual(r.results.map((x) => x.status), ["paid", "paid"]);
  assert.deepEqual(r.results.map((x) => x.reference), [`payout_${E1}`, `payout_${E2}`]);
  assert.equal(ps.recipients.length, 1); assert.deepEqual(ps.recipients[0], { name: "Agent 5", accountNumberLocal: "0722000111" });
  assert.deepEqual(ps.initiated.map((i) => [i.amountMinor, i.reference, i.recipientCode]), [[200_000, `payout_${E1}`, "RCP_1"], [50_000, `payout_${E2}`, "RCP_1"]]);
  const a = await row(E1);
  assert.equal(a.status, "paid"); assert.equal(a.transferRef, `payout_${E1}`); assert.equal(a.transferCode, "TRF_1"); assert.ok(a.paidAt);
  assert.equal(a.payoutError, undefined); assert.equal(a.processingAt, undefined);
  assert.equal((await dayDoc())!.sentMinor, 250_000);
  assert.equal((await col("agents").doc("5").get()).data()!.payoutRecipientCode, "RCP_1");
  const audits = (await col("audit").get()).docs.map((d) => d.data().action);
  assert.equal(audits.filter((x) => x === "top_payout_entry").length, 2); assert.equal(audits.filter((x) => x === "top_payout").length, 1);
});
test("a changed M-Pesa number gets a new recipient", async () => {
  await seedAgent("5", { payoutRecipientCode: "OLD", payoutRecipientMsisdn: "0700000000" } as never);
  await seedLedger(E1, "5");
  await pay([E1], 200_000, 1);
  assert.equal(ps.recipients.length, 1); assert.equal(ps.initiated[0].recipientCode, "RCP_1");
});
test("an existing recipient for the same number is reused", async () => {
  await seedAgent("5", { payoutRecipientCode: "KEEP", payoutRecipientMsisdn: "0711000000" } as never);
  await seedLedger(E1, "5");
  await pay([E1], 200_000, 1);
  assert.equal(ps.recipients.length, 0); assert.equal(ps.initiated[0].recipientCode, "KEEP");
});

// ------------------------------------------------------------------ gating
test("no code, wrong code, expired code, wrong action, wrong summary: nothing is paid", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  const run = (o: object) => topPayout(deps(), topAuth(), { entryIds: [E1], ...o });
  await rejects(run({}), "invalid_argument");
  await rejects(run({ actionId: "none", otp: "123456" }), "otp_required");
  await seedTopOtp("p1", "payout", summaryTopPayout(200_000, 1));
  await rejects(run({ actionId: "p1", otp: "000000" }), "otp_invalid");
  await seedTopOtp("p2", "payout", summaryTopPayout(200_000, 1), "123456", { otpExpiresAt: clock - 1 });
  await rejects(run({ actionId: "p2", otp: "123456" }), "otp_invalid", /expired/);
  await seedTopOtp("p3", "set_rank", summaryTopPayout(200_000, 1));
  await rejects(run({ actionId: "p3", otp: "123456" }), "permission_denied", /different action/);
  await seedTopOtp("p4", "payout", summaryTopPayout(199_999, 1)); // the code was issued for a different total
  await rejects(run({ actionId: "p4", otp: "123456" }), "permission_denied", /different action/);
  await seedTopOtp("p5", "payout", summaryTopPayout(200_000, 2)); // ...or a different number of desks
  await rejects(run({ actionId: "p5", otp: "123456" }), "permission_denied", /different action/);
  assert.equal(ps.initiated.length, 0); assert.equal((await row(E1)).status, "payable"); assert.equal(await dayDoc(), undefined);
  assert.equal((await col("topOtps").doc("p4").get()).data()!.consumedAt, undefined);
});
test("non-top callers are refused before anything is read", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  await rejects(topPayout(deps(), topAuth({ email: "x@gmail.com" }), { entryIds: [E1], actionId: "p", otp: "123456" }), "permission_denied");
  await rejects(topPayout(deps(), topAuth({ authTime: Math.floor(clock / 1000) - 3600 }), { entryIds: [E1], actionId: "p", otp: "123456" }), "unauthenticated");
  await rejects(topListPayables(deps(), topAuth({ verified: false })), "permission_denied");
  assert.equal(ps.initiated.length, 0);
});
test("entry validation: shape, duplicates, kinds, status, inactive desk", async () => {
  await seedAgent("5"); await seedAgent("6", { status: "suspended" });
  await seedLedger(E1, "5"); await seedLedger(E2, "5", { status: "paid" }); await seedLedger(E3, "6"); await seedLedger(eid(4), "5", { kind: "service" });
  const go = (ids: unknown) => topPayout(deps(), topAuth(), { entryIds: ids, actionId: "p", otp: "123456" });
  await rejects(go([]), "invalid_argument"); await rejects(go("x"), "invalid_argument"); await rejects(go(["nope"]), "invalid_argument");
  await rejects(go([E1, E1]), "invalid_argument", /twice/);
  await rejects(go(Array.from({ length: 51 }, (_, i) => eid(i + 10))), "invalid_argument", /at most 50/);
  await rejects(go([E2]), "failed_precondition", /no longer payable/); await rejects(go([eid(99)]), "failed_precondition");
  await rejects(go([eid(4)]), "failed_precondition", /no longer payable/); // not a bonus/support row
  await rejects(go([E3]), "failed_precondition", /active/);
  assert.equal(ps.initiated.length, 0);
});

// ------------------------------------------------------------------ cap and double pay
test("the daily cap: a batch over the remaining cap is refused whole, before the code is consumed", async () => {
  cfg = cfgWith({ topDesk: { ...DEFAULT_DESK_CONFIG.topDesk, dailyPayoutCapMinor: 300_000 } });
  await seedAgent("5"); await seedLedger(E1, "5", { amountMinor: 200_000 }); await seedLedger(E2, "5", { amountMinor: 200_000 });
  await seedTopOtp("p1", "payout", summaryTopPayout(400_000, 1));
  await rejects(topPayout(deps(), topAuth(), { entryIds: [E1, E2], actionId: "p1", otp: "123456" }), "failed_precondition", /remaining payout limit \(KES 3000\.00 left\)/);
  assert.equal((await col("topOtps").doc("p1").get()).data()!.consumedAt, undefined);
  assert.equal(ps.initiated.length, 0);
  assert.equal((await pay([E1], 200_000, 1, "p2")).results[0].status, "paid");
  await rejects(pay([E2], 200_000, 1, "p3"), "failed_precondition", /KES 1000\.00 left/);
  assert.equal((await row(E2)).status, "payable");
  // the cap is exact: 100_000 more fits, one cent more does not
  await seedLedger(eid(7), "5", { amountMinor: 100_001 }); await seedLedger(eid(8), "5", { amountMinor: 100_000 });
  await rejects(pay([eid(7)], 100_001, 1, "p4"), "failed_precondition");
  assert.equal((await pay([eid(8)], 100_000, 1, "p5")).results[0].status, "paid");
  assert.equal((await dayDoc())!.sentMinor, 300_000);
});
test("concurrent payouts cannot jointly exceed the cap (reservation is transactional)", async () => {
  cfg = cfgWith({ topDesk: { ...DEFAULT_DESK_CONFIG.topDesk, dailyPayoutCapMinor: 300_000 } });
  await seedAgent("5");
  for (let i = 1; i <= 4; i++) await seedLedger(eid(i), "5", { amountMinor: 100_000 });
  await seedTopOtp("pa", "payout", summaryTopPayout(200_000, 1)); await seedTopOtp("pb", "payout", summaryTopPayout(200_000, 1));
  const a = topPayout(deps(), topAuth(), { entryIds: [eid(1), eid(2)], actionId: "pa", otp: "123456" });
  const b = topPayout(deps(), topAuth(), { entryIds: [eid(3), eid(4)], actionId: "pb", otp: "123456" });
  const settled = await Promise.allSettled([a, b]);
  const results = settled.flatMap((s) => (s.status === "fulfilled" ? s.value.results : []));
  const paid = results.filter((r) => r.status === "paid").length;
  assert.equal(paid, 3, JSON.stringify(settled.map((s) => (s.status === "fulfilled" ? s.value : String((s as PromiseRejectedResult).reason)))));
  assert.ok(results.some((r) => r.status === "failed" && /exceed today's payout limit/.test(r.error ?? "")));
  assert.equal((await dayDoc())!.sentMinor, 300_000); assert.equal(ps.initiated.length, 3);
});
test("a paid entry cannot be paid again, and two payouts racing for one entry send one transfer", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  await pay([E1], 200_000, 1, "p1");
  await seedTopOtp("p2", "payout", summaryTopPayout(200_000, 1));
  await rejects(topPayout(deps(), topAuth(), { entryIds: [E1], actionId: "p2", otp: "123456" }), "failed_precondition", /no longer payable/);
  await seedLedger(E2, "5");
  await seedTopOtp("pa", "payout", summaryTopPayout(200_000, 1)); await seedTopOtp("pb", "payout", summaryTopPayout(200_000, 1));
  const [x, y] = await Promise.allSettled([
    topPayout(deps(), topAuth(), { entryIds: [E2], actionId: "pa", otp: "123456" }), topPayout(deps(), topAuth(), { entryIds: [E2], actionId: "pb", otp: "123456" }),
  ]);
  const statuses = [x, y].flatMap((s) => (s.status === "fulfilled" ? s.value.results.map((r) => r.status) : ["rejected"]));
  assert.equal(statuses.filter((s) => s === "paid").length, 1, statuses.join());
  assert.equal(ps.initiated.filter((i) => i.reference === `payout_${E2}`).length, 1);
  assert.equal((await dayDoc())!.sentMinor, 400_000);
});
test("the same code cannot start a second payout", async () => {
  await seedAgent("5"); await seedLedger(E1, "5"); await seedLedger(E2, "5");
  await pay([E1], 200_000, 1, "p1");
  await rejects(topPayout(deps(), topAuth(), { entryIds: [E2], actionId: "p1", otp: "123456" }), "otp_required", /already used/);
  assert.equal((await row(E2)).status, "payable");
});

// ------------------------------------------------------------------ failures
test("Paystack rejects the transfer: entry returns to payable with the reason, nothing stays reserved", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.failInitiate = "reject";
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "failed"); assert.match(r.results[0].error!, /balance is not enough/);
  const a = await row(E1);
  assert.equal(a.status, "payable"); assert.match(a.payoutError, /balance is not enough/); assert.equal(a.processingAt, undefined); assert.equal(a.payoutAttempt ?? 0, 0);
  assert.equal((await dayDoc())!.sentMinor, 0);
  // fixed at Paystack: the retry uses the SAME reference (nothing was created), and pays
  ps.failInitiate = "none";
  const again = await pay([E1], 200_000, 1, "p2");
  assert.equal(again.results[0].status, "paid"); assert.equal(again.results[0].reference, `payout_${E1}`);
  assert.equal((await row(E1)).payoutError, undefined);
});
test("recipient creation fails: payable again, no transfer attempted", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.failRecipient = true;
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "failed"); assert.match(r.results[0].error!, /Recipient rejected/);
  assert.equal(ps.initiated.length, 0); assert.equal((await row(E1)).status, "payable"); assert.equal((await dayDoc())!.sentMinor, 0);
});
test("a desk with an unusable payout number fails cleanly", async () => {
  await seedAgent("5", {}, { settlementBank: "mpesa", accountNumber: "12" }); await seedLedger(E1, "5");
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "failed"); assert.equal((await row(E1)).status, "payable");
});
test("a transfer that comes back failed returns the entry, bumps the reference, and a retry cannot reuse the dead one", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.initiateStatus = "failed";
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "failed");
  let a = await row(E1);
  assert.equal(a.status, "payable"); assert.equal(a.payoutAttempt, 1); assert.equal((await dayDoc())!.sentMinor, 0);
  ps.initiateStatus = "success";
  const again = await pay([E1], 200_000, 1, "p2");
  assert.equal(again.results[0].reference, payoutReference(E1, 1)); assert.equal(again.results[0].status, "paid");
  a = await row(E1); assert.equal(a.transferRef, payoutReference(E1, 1));
});
test("Paystack asks for a transfer OTP: reported as a setup problem, the entry stays in processing", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.initiateStatus = "otp";
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "processing"); assert.equal(r.results[0].error, OTP_SETUP_MESSAGE);
  const a = await row(E1);
  assert.equal(a.status, "processing"); assert.equal(a.payoutError, OTP_SETUP_MESSAGE); assert.equal((await dayDoc())!.sentMinor, 200_000);
  // it cannot be sent a second time while in flight
  await seedTopOtp("p2", "payout", summaryTopPayout(200_000, 1));
  await rejects(topPayout(deps(), topAuth(), { entryIds: [E1], actionId: "p2", otp: "123456" }), "failed_precondition", /no longer payable/);
});
test("Paystack pending: stays processing with the amount reserved", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.initiateStatus = "pending";
  assert.equal((await pay([E1], 200_000, 1)).results[0].status, "processing");
  assert.equal((await row(E1)).status, "processing"); assert.equal((await dayDoc())!.sentMinor, 200_000);
});
test("request timed out but the transfer exists at Paystack: adopted, never created twice", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.failInitiate = "timeout-but-created";
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "paid"); assert.equal(ps.initiated.length, 1);
});
test("request timed out and Paystack has no such transfer: payable again, same reference next time", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.failInitiate = "timeout-not-created";
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "failed"); assert.equal((await row(E1)).status, "payable"); assert.equal((await dayDoc())!.sentMinor, 0);
});
test("an earlier attempt already created the transfer: it is adopted instead of creating another", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.transfers.set(`payout_${E1}`, { status: "success", amountMinor: 200_000, transferCode: "TRF_old" });
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "paid"); assert.equal(ps.initiated.length, 0); assert.equal((await row(E1)).transferCode, "TRF_old");
});
test("a transfer whose confirmed amount differs is never marked paid", async () => {
  await seedAgent("5"); await seedLedger(E1, "5");
  ps.transfers.set(`payout_${E1}`, { status: "success", amountMinor: 199_999, transferCode: "TRF_x" });
  const r = await pay([E1], 200_000, 1);
  assert.equal(r.results[0].status, "processing");
  const a = await row(E1); assert.equal(a.status, "processing"); assert.match(a.payoutError, /different amount/);
});

// ------------------------------------------------------------------ list
test("listPayables: payable bonus/support rows with desk info, cap and today's total", async () => {
  await seedAgent("5", { name: "Wanjiru" }); await seedAgent("6", { name: "Otieno" });
  await seedLedger(E1, "5", { createdAt: 1 }); await seedLedger(E2, "6", { kind: "support", amountMinor: 30_000, createdAt: 2 });
  await seedLedger(E3, "5", { status: "settled" }); await seedLedger(eid(4), "5", { kind: "service" }); await seedLedger(eid(5), "5", { status: "paid" });
  await seedLedger(eid(6), "ghost", {});
  const r = await topListPayables(deps(), topAuth());
  assert.deepEqual(r.payables.map((p) => [p.entryId, p.deskCode, p.name, p.kind, p.amountMinor]), [[E1, "COG-0005", "Wanjiru", "bonus", 200_000], [E2, "COG-0006", "Otieno", "support", 30_000]]);
  assert.equal(r.payables[0].note, "Milestone block 1"); assert.equal(r.dailyCapMinor, cfg.topDesk.dailyPayoutCapMinor); assert.equal(r.paidTodayMinor, 0);
  await pay([E1], 200_000, 1);
  assert.equal((await topListPayables(deps(), topAuth())).paidTodayMinor, 200_000);
});
test("the cap counter resets at Nairobi midnight", async () => {
  cfg = cfgWith({ topDesk: { ...DEFAULT_DESK_CONFIG.topDesk, dailyPayoutCapMinor: 200_000 } });
  await seedAgent("5"); await seedLedger(E1, "5"); await seedLedger(E2, "5");
  clock = Date.UTC(2026, 5, 1, 20, 0, 0); // 23:00 in Nairobi
  assert.equal((await pay([E1], 200_000, 1, "p1")).results[0].status, "paid");
  await rejects(pay([E2], 200_000, 1, "p2"), "failed_precondition");
  clock = Date.UTC(2026, 5, 1, 21, 0, 1); // just past midnight in Nairobi
  assert.equal((await topListPayables(deps(), topAuth())).paidTodayMinor, 0);
  assert.equal((await pay([E2], 200_000, 1, "p3")).results[0].status, "paid");
});

// ------------------------------------------------------------------ reconciler
test("reconcile: processing -> paid, failed -> payable (cap released), young and unknown rows untouched, never-sent rows freed", async () => {
  await seedAgent("5");
  ps.initiateStatus = "pending";
  for (const [i, n] of [[1, 200_000], [2, 100_000], [3, 50_000]] as const) await seedLedger(eid(i), "5", { amountMinor: n });
  await pay([eid(1), eid(2), eid(3)], 350_000, 1);
  assert.equal((await dayDoc())!.sentMinor, 350_000);
  ps.transfers.get(`payout_${eid(1)}`)!.status = "success"; ps.transfers.get(`payout_${eid(2)}`)!.status = "reversed";
  // too young: nothing happens yet
  clock += 30_000;
  assert.deepEqual(await reconcilePayouts(deps()), { checked: 0, paid: 0, returned: 0, waiting: 0, errors: 0 });
  clock += 60_000;
  const s = await reconcilePayouts(deps());
  assert.deepEqual(s, { checked: 3, paid: 1, returned: 1, waiting: 1, errors: 0 });
  assert.equal((await row(eid(1))).status, "paid"); assert.ok((await row(eid(1))).paidAt); assert.equal((await row(eid(1))).transferCode, "TRF_1");
  const b = await row(eid(2)); assert.equal(b.status, "payable"); assert.equal(b.payoutAttempt, 1); assert.match(b.payoutError, /reversed/);
  assert.equal((await row(eid(3))).status, "processing");
  assert.equal((await dayDoc())!.sentMinor, 250_000);
  // idempotent
  assert.equal((await reconcilePayouts(deps())).paid, 0);
  // a row Paystack never saw is freed only after the orphan window
  ps.transfers.delete(`payout_${eid(3)}`);
  assert.equal((await reconcilePayouts(deps())).returned, 0);
  clock += 5 * 60_000;
  assert.equal((await reconcilePayouts(deps())).returned, 1);
  const c = await row(eid(3)); assert.equal(c.status, "payable"); assert.equal(c.payoutAttempt ?? 0, 0); assert.equal((await dayDoc())!.sentMinor, 200_000);
  const au = (await col("audit").where("action", "==", "payout_reconciled").get()).docs.map((d) => d.data().meta.outcome).sort();
  assert.deepEqual(au, ["failed", "never_sent", "paid"]);
});
test("reconcile: a Paystack error on one row does not stop the others", async () => {
  await seedAgent("5"); ps.initiateStatus = "pending";
  await seedLedger(E1, "5", { amountMinor: 100_000 }); await seedLedger(E2, "5", { amountMinor: 100_000 });
  await pay([E1, E2], 200_000, 1);
  ps.transfers.get(`payout_${E2}`)!.status = "success";
  const orig = ps.verify.bind(ps);
  ps.verify = async (r) => { if (r === `payout_${E1}`) throw new DeskError("payment_failed", "network"); return orig(r); };
  clock += 120_000;
  const s = await reconcilePayouts(deps());
  assert.equal(s.errors, 1); assert.equal(s.paid, 1); assert.equal((await row(E2)).status, "paid"); assert.equal((await row(E1)).status, "processing");
});
test("reconcile handles at most 100 rows per run", async () => {
  await seedAgent("5");
  for (let i = 1; i <= 105; i++) await seedLedger(eid(i), "5", { status: "processing", processingAt: 1, transferRef: `payout_${eid(i)}`, createdAt: i });
  for (let i = 1; i <= 105; i++) ps.transfers.set(`payout_${eid(i)}`, { status: "success", amountMinor: 200_000, transferCode: `T${i}` });
  assert.equal((await reconcilePayouts(deps())).paid, 100);
  assert.equal((await reconcilePayouts(deps())).paid, 5);
});

// ------------------------------------------------------------------ support payables
const MONTH_START = Date.UTC(2026, 8, 1) - 3 * 3600_000; // 1 Sep 00:00 Nairobi
const supportItem = async (id: string, agentId: string, at: number | undefined) =>
  col("support").doc(id).set({ supportId: id, agentId, ...(at === undefined ? {} : { customerConfirmedAt: at }), createdAt: 1 });
test("prepareSupportPayables: previous month, per-day cap, rate and monthly cap, idempotent", async () => {
  cfg = cfgWith({ support: { rateMinorPerConfirmed: 5_000, maxConfirmedPerDay: 2, monthlyCapMinor: 40_000 } });
  await seedAgent("5"); await seedAgent("6"); await seedAgent("7", { status: "suspended" });
  const day = (d: number, h = 12) => MONTH_START + (d - 1) * 86_400_000 + h * 3600_000;
  // desk 5: 3 items on 3 Sep (2 count) + 1 on 4 Sep = 3 counted -> 15_000
  for (const [i, at] of [[1, day(3, 9)], [2, day(3, 10)], [3, day(3, 11)], [4, day(4)]] as const) await supportItem(`s${i}`, "5", at);
  // outside the month and unconfirmed items never count
  await supportItem("o1", "5", MONTH_START - 1); await supportItem("o2", "5", MONTH_START + 30 * 86_400_000); await supportItem("o3", "5", undefined);
  // desk 6: 12 days x 2 = 24 counted -> 120_000 capped to 40_000
  for (let d = 1; d <= 12; d++) for (let k = 0; k < 2; k++) await supportItem(`x${d}${k}`, "6", day(d, 8 + k));
  await supportItem("sus", "7", day(2));
  clock = Date.UTC(2026, 9, 1, 3, 0, 0); // 1 Oct 06:00 Nairobi
  const s = await prepareSupportPayables({ now: () => clock, getConfig: async () => cfg });
  assert.equal(s.month, "2026-09"); assert.equal(s.created, 2); assert.equal(s.errors, 0);
  const rows = (await col("ledger").where("kind", "==", "support").get()).docs.map((d) => d.data());
  assert.equal(rows.length, 2);
  const by = Object.fromEntries(rows.map((r) => [r.agentId, r]));
  assert.equal(by["5"].amountMinor, 15_000); assert.equal(by["6"].amountMinor, 40_000); assert.equal(by["5"].status, "payable"); assert.equal(by["5"].sourceId, "2026-09");
  assert.equal((await col("support").doc("s1").get()).data()!.paidMonth, "2026-09");
  assert.equal((await col("support").doc("o1").get()).data()!.paidMonth, undefined);
  const again = await prepareSupportPayables({ now: () => clock, getConfig: async () => cfg });
  assert.equal(again.created, 0); assert.equal((await col("ledger").where("kind", "==", "support").get()).size, 2);
  assert.equal((await col("audit").where("action", "==", "support_payable_prepared").get()).size, 2);
});
test("prepareSupportPayables does nothing while the rate or the cap is 0", async () => {
  await seedAgent("5"); await supportItem("s1", "5", MONTH_START + 3600_000);
  clock = Date.UTC(2026, 9, 1, 3, 0, 0);
  for (const support of [{ rateMinorPerConfirmed: 0, maxConfirmedPerDay: 5, monthlyCapMinor: 100_000 }, { rateMinorPerConfirmed: 5_000, maxConfirmedPerDay: 5, monthlyCapMinor: 0 }]) {
    const s = await prepareSupportPayables({ now: () => clock, getConfig: async () => cfgWith({ support }) });
    assert.equal(s.created, 0);
  }
  assert.equal((await col("ledger").get()).size, 0);
});
