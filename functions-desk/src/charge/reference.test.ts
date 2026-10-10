import { test } from "node:test";
import assert from "node:assert/strict";
import { FieldValue } from "firebase-admin/firestore";
import { buildDeskReference, parseDeskReference } from "./reference.js";
import { buildCyberTransaction, buildChargeMetadata } from "./cyberTransaction.js";
import type { DeskTicket } from "../tickets/model.js";

test("references are CYBER_DSK_<ticketId>_<attempt> and parse back", () => {
  const r = buildDeskReference("AbC123xyz", 2);
  assert.equal(r, "CYBER_DSK_AbC123xyz_2");
  assert.deepEqual(parseDeskReference(r), { ticketId: "AbC123xyz", attempt: 2 });
  for (const bad of ["CYBER_x_1", "CYBER_DSK_abc", "CYBER_DSK_abc_0", "CYBER_DSK__1", "CYBER_DSK_a_b_1", "SMS_DSK_a_1"]) assert.equal(parseDeskReference(bad), undefined);
});

const ticket = { ticketId: "T1", agentId: "u1", entityKey: "chama:SMC-0001", amountMinor: 22050, serviceType: "manual_entry" } as DeskTicket;
const pay = { uid: "u1", subaccountCode: "ACCT_x", email: "a@b.co", pId: "P-1", id: "AG-1" };

test("cyber-transactions document copies PAY's chargeCustomer fields and units (KES, not minor)", () => {
  const doc = buildCyberTransaction({ pay, ticket, reference: "CYBER_DSK_T1_1", phoneE164: "+254712345678", splitCode: "SPL_1", commissionRate: 2.5 });
  for (const k of ["pId", "uid", "agentId", "service", "phone", "amount", "currency", "status", "reference", "splitCode", "subaccountCode", "commissionRate", "createdAt"]) assert.ok(k in doc, k);
  assert.equal(doc.amount, 220.5);
  assert.equal(doc.currency, "KES");
  assert.equal(doc.status, "pending");
  assert.equal(doc.agentId, "AG-1");
  assert.equal(doc.deskTicketId, "T1");
  assert.equal(doc.deskAgentId, "u1");
  assert.equal(doc.entityKey, "chama:SMC-0001");
  assert.equal(doc.serviceType, "manual_entry");
  assert.ok(doc.createdAt instanceof FieldValue.serverTimestamp().constructor);
});

test("charge metadata carries chargeType cyber_service and the desk fields", () => {
  const m = buildChargeMetadata({ pay, ticket, reference: "CYBER_DSK_T1_1", phoneE164: "+254712345678", splitCode: "SPL_1", commissionRate: 2.5 });
  assert.equal(m.chargeType, "cyber_service");
  assert.equal(m.originalAmount, 220.5);
  assert.equal(m.commissionRate, 2.5);
  assert.equal(m.uid, "u1"); assert.equal(m.pId, "P-1"); assert.equal(m.service, "manual_entry");
  assert.equal(m.deskTicketId, "T1");
});
