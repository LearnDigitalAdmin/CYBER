import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { DEFAULT_DESK_CONFIG, mergeConfig } from "../config.js";
import { callDelegate, delegateAudience, delegateUrl } from "./delegate.js";

function serve(handler: (body: Record<string, unknown>, req: IncomingMessage) => { status: number; json: unknown }) {
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const out = handler(JSON.parse(raw || "{}"), req);
      res.writeHead(out.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out.json));
    });
  });
  return new Promise<{ url: string; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, close: () => server.close() })));
}
const token = async () => "test-token";

test("delegate URL must be configured, valid and https (localhost excepted)", () => {
  assert.throws(() => delegateUrl(DEFAULT_DESK_CONFIG, "chama"), /not connected/);
  assert.throws(() => delegateUrl(mergeConfig({ delegate: { chama: "not a url", school: "", pms: "" } }), "chama"), /invalid/);
  assert.throws(() => delegateUrl(mergeConfig({ delegate: { chama: "http://example.com/x", school: "", pms: "" } }), "chama"), /https/);
  assert.equal(delegateUrl(mergeConfig({ delegate: { chama: "https://x.run.app/deskDelegate", school: "", pms: "" } }), "chama"), "https://x.run.app/deskDelegate");
});

test("sends the signed request and returns the product result", async () => {
  let seenAuth = ""; let seenBody: Record<string, unknown> = {};
  const s = await serve((body, req) => { seenAuth = String(req.headers.authorization); seenBody = body; return { status: 200, json: { ok: true, result: { created: 3 } } }; });
  const cfg = mergeConfig({ delegate: { chama: s.url, school: "", pms: "" } });
  const out = await callDelegate<{ created: number }>(cfg, "chama",
    { action: "commit_records", entityCode: "SMC-0042", agentCode: "AGT-00001", payload: { rows: [] }, requestId: "r1" }, { getIdToken: token });
  s.close();
  assert.equal(out.created, 3);
  assert.equal(seenAuth, "Bearer test-token");
  assert.equal(seenBody.requestId, "r1");
  assert.equal(seenBody.action, "commit_records");
});
test("product business errors surface with the product's own message", async () => {
  const s = await serve(() => ({ status: 200, json: { ok: false, error: { code: "plan_limit", message: "Free plan allows 6 members" } } }));
  const cfg = mergeConfig({ delegate: { chama: s.url, school: "", pms: "" } });
  await assert.rejects(() => callDelegate(cfg, "chama", { action: "commit_records", entityCode: "A", agentCode: "B", payload: {} }, { getIdToken: token }),
    (e: Error & { code?: string }) => e.code === "failed_precondition" && /6 members/.test(e.message));
  s.close();
});
test("IAM refusal and unreachable service are distinguished", async () => {
  const s = await serve(() => ({ status: 403, json: {} }));
  const cfg = mergeConfig({ delegate: { chama: s.url, school: "", pms: "" } });
  await assert.rejects(() => callDelegate(cfg, "chama", { action: "entity_info", entityCode: "A", agentCode: "B", payload: {} }, { getIdToken: token }),
    (e: Error & { code?: string }) => e.code === "permission_denied");
  s.close();
  await assert.rejects(() => callDelegate(cfg, "chama", { action: "entity_info", entityCode: "A", agentCode: "B", payload: {} }, { getIdToken: token, timeoutMs: 500 }),
    (e: Error & { code?: string }) => e.code === "internal");
});
test("a missing requestId is generated", async () => {
  let id = "";
  const s = await serve((b) => { id = String(b.requestId); return { status: 200, json: { ok: true, result: {} } }; });
  await callDelegate(mergeConfig({ delegate: { chama: s.url, school: "", pms: "" } }), "chama", { action: "entity_info", entityCode: "A", agentCode: "B", payload: {} }, { getIdToken: token });
  s.close();
  assert.match(id, /^[0-9a-f-]{36}$/);
});

test("ID-token audience: run.app uses the origin, cloudfunctions.net keeps the full path, query is dropped", () => {
  assert.equal(delegateAudience("https://deskdelegate-abc123-ew.a.run.app/some/path?x=1"), "https://deskdelegate-abc123-ew.a.run.app");
  assert.equal(delegateAudience("https://africa-south1-proj.cloudfunctions.net/deskdelegate?x=1#h"), "https://africa-south1-proj.cloudfunctions.net/deskdelegate");
});
