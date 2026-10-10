import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG, mergeConfig } from "../config.js";
import { pickSubaccount } from "./agents.js";

const info = { accountId: "ACCT_main", productAccounts: { chama: "ACCT_chama" } };

test("main account is used for every product while all products charge through it", () => {
  assert.equal(pickSubaccount(info, "main", DEFAULT_DESK_CONFIG), "ACCT_main");
  assert.equal(pickSubaccount(info, "chama", DEFAULT_DESK_CONFIG), "ACCT_main");
});
test("a separate product account uses the product's own subaccount; desk services still use main", () => {
  const cfg = mergeConfig({ paystackAccounts: { chama: "separate", school: "main", pms: "main" } });
  assert.equal(pickSubaccount(info, "chama", cfg), "ACCT_chama");
  assert.equal(pickSubaccount(info, "main", cfg), "ACCT_main");
  assert.equal(pickSubaccount(info, "school", cfg), "ACCT_main");
});
test("a missing separate subaccount fails with a clear next step, never falls back to the wrong account", () => {
  const cfg = mergeConfig({ paystackAccounts: { chama: "separate", school: "main", pms: "main" } });
  assert.throws(() => pickSubaccount({ accountId: "ACCT_main" }, "chama", cfg), /Payout accounts/);
  assert.throws(() => pickSubaccount(undefined, "main", cfg), /payment account/);
});
