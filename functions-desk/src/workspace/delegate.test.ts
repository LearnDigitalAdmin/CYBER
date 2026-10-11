import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mergeConfig } from "../config.js";
import { DeskError } from "../errors.js";
import { isUnsupportedReply, makeProductDelegate } from "./delegate.js";
import { ProductUnsupportedError } from "./errors.js";

function serve(status: number, body: string, contentType = "application/json") {
  const server = createServer((req, res) => { req.resume(); req.on("end", () => { res.writeHead(status, { "Content-Type": contentType }); res.end(body); }); });
  return new Promise<{ url: string; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, close: () => server.close() })));
}
const token = async () => "t";
const req = { action: "list_tenants" as const, entityCode: "PYL-0001", agentCode: "COG-0001", payload: {} };
async function call(status: number, body: string, contentType?: string) {
  const s = await serve(status, body, contentType);
  try { return await makeProductDelegate({ getIdToken: token })(mergeConfig({ delegate: { chama: "", school: "", pms: s.url } }), "pms", req); } finally { s.close(); }
}

test("unknown-action replies are recognised; ordinary failures are not", () => {
  assert.equal(isUnsupportedReply({ status: 200, code: "unknown_action" }), true);
  assert.equal(isUnsupportedReply({ status: 200, code: "UNSUPPORTED_ACTION" }), true);
  assert.equal(isUnsupportedReply({ status: 501 }), true);
  assert.equal(isUnsupportedReply({ status: 200, code: "invalid_argument", message: "Unknown action: list_tenants" }), true);
  assert.equal(isUnsupportedReply({ status: 200, code: "not_found", message: "Action not implemented" }), true);
  assert.equal(isUnsupportedReply({ status: 200, code: "not_found", message: "No landlord with that code" }), false);
  assert.equal(isUnsupportedReply({ status: 200, code: "invalid_argument", message: "Phone is not valid" }), false);
  assert.equal(isUnsupportedReply({ status: 200, code: "permission_denied", message: "unknown action" }), false);
  assert.equal(isUnsupportedReply({ status: 500 }), false);
});

test("a product that does not know the action becomes a typed, readable refusal", async () => {
  await assert.rejects(call(200, JSON.stringify({ ok: false, error: { code: "unknown_action", message: "?" } })), (e: unknown) =>
    e instanceof ProductUnsupportedError && e.code === "failed_precondition" && e.reason === "product_unsupported" && /Plot Yangu doesn't support this yet/.test(e.message));
  await assert.rejects(call(501, "Not Implemented", "text/plain"), ProductUnsupportedError);
});
test("other product errors keep the kernel's mapping and message", async () => {
  await assert.rejects(call(200, JSON.stringify({ ok: false, error: { code: "not_found", message: "No landlord with that code" } })), (e: unknown) =>
    e instanceof DeskError && !(e instanceof ProductUnsupportedError) && e.code === "not_found" && /No landlord/.test(e.message));
  await assert.rejects(call(403, "{}"), (e: unknown) => e instanceof DeskError && e.code === "permission_denied");
});
test("successful results pass through untouched", async () => {
  const out = await call(200, JSON.stringify({ ok: true, result: { tenants: [], nextCursor: undefined } }));
  assert.deepEqual(out, { tenants: [] });
});
