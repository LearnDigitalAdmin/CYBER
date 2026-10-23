import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPhone, normalizeKenyaPhone } from "./phone.js";
import { splitKey, validateSplit } from "./splits.js";

test("phone numbers normalise to E.164", () => {
  for (const raw of ["0712345678", "712345678", "254712345678", "+254 712 345 678", "0112345678"])
    assert.match(normalizeKenyaPhone(raw), /^\+254[17]\d{8}$/);
  assert.equal(normalizeKenyaPhone("0712345678"), "+254712345678");
  assert.equal(maskPhone("+254712345678"), "+2547•• ••• 678");
});
test("bad phone numbers are rejected", () => {
  for (const raw of ["", "0212345678", "12345", "+255712345678", "07123456789", "0733123456", "0750123456", "0100123456", "abc0712345678"])
    assert.throws(() => normalizeKenyaPhone(raw));
});
test("split keys are stable, order-independent and share-sensitive", () => {
  const a = splitKey([{ subaccount: "ACCT_a", sharePct: 97.5 }, { subaccount: "ACCT_b", sharePct: 0.45 }]);
  const b = splitKey([{ subaccount: "ACCT_b", sharePct: 0.45 }, { subaccount: "ACCT_a", sharePct: 97.5 }]);
  assert.equal(a, b);
  assert.notEqual(a, splitKey([{ subaccount: "ACCT_a", sharePct: 97.4 }, { subaccount: "ACCT_b", sharePct: 0.45 }]));
});
test("split validation protects the platform's remainder", () => {
  assert.doesNotThrow(() => validateSplit([{ subaccount: "ACCT_a", sharePct: 97.5 }]));
  assert.throws(() => validateSplit([]));
  assert.throws(() => validateSplit([{ subaccount: "ACCT_a", sharePct: 100 }]));
  assert.throws(() => validateSplit([{ subaccount: "ACCT_a", sharePct: 60 }, { subaccount: "ACCT_b", sharePct: 40 }]));
  assert.throws(() => validateSplit([{ subaccount: "bad", sharePct: 10 }]));
  assert.throws(() => validateSplit([{ subaccount: "ACCT_a", sharePct: 0 }]));
});

import { buildSubaccountBody } from "./subaccount.js";
test("subaccount body mirrors PAY's setupAccount and validates inputs", () => {
  const body = buildSubaccountBody({
    businessName: " Wanjiru Desk ", settlementBank: "063", accountNumber: "0123 4567 89", contactName: "Wanjiru",
    contactEmail: "w@samuhia.co.ke", contactPhone: "0712345678", metadata: { deskCode: "COG-0007" },
  });
  assert.equal(body.business_name, "Wanjiru Desk");
  assert.equal(body.account_number, "0123456789");
  assert.equal(body.percentage_charge, 0);
  assert.equal(body.primary_contact_phone, "+254712345678");
  assert.throws(() => buildSubaccountBody({ businessName: "", settlementBank: "063", accountNumber: "123456", contactName: "x", contactEmail: "a@b.co", contactPhone: "0712345678" }));
  assert.throws(() => buildSubaccountBody({ businessName: "x", settlementBank: "063", accountNumber: "12", contactName: "x", contactEmail: "a@b.co", contactPhone: "0712345678" }));
  assert.throws(() => buildSubaccountBody({ businessName: "x", settlementBank: "063", accountNumber: "123456", contactName: "x", contactEmail: "nope", contactPhone: "0712345678" }));
});
