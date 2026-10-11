/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { RequestView } from "../../api/contract";
import { applyLocalUpdate, mergeRequests, nextCursor, replaceHead, sortedThread, statusActions, timeAgo, validateNewRequest, validateReply } from "./logic";

const req = (id: string, createdAt: number, over: Partial<RequestView> = {}): RequestView => ({
  id, source: "chama", entityCode: "SMC-0001", entityName: "Group", requesterName: "A", requesterPhone: "0700", category: "sms",
  subject: "s", message: "m", status: "new", targetDeskCodes: [], responses: [], createdAt, updatedAt: createdAt, ...over,
});

test("status actions follow the lifecycle", () => {
  assert.deepEqual(statusActions("new").map((a) => a.to), ["open", "closed"]);
  assert.deepEqual(statusActions("closed").map((a) => a.to), ["open"]);
  assert.deepEqual(statusActions("answered").map((a) => a.to), ["open", "closed"]);
});

test("reply validation", () => {
  assert.equal(validateReply("   ").ok, false);
  assert.equal(validateReply("x".repeat(1001)).ok, false);
  const v = validateReply("  hello  ");
  assert.ok(v.ok && v.value === "hello");
});

test("new request validation trims and bounds", () => {
  const cats = ["setup", "other"];
  assert.equal(validateNewRequest({ category: "nope", subject: "Hello there", message: "A long enough message" }, cats).errors.category !== undefined, true);
  assert.equal(validateNewRequest({ category: "setup", subject: "ab", message: "A long enough message" }, cats).errors.subject !== undefined, true);
  assert.equal(validateNewRequest({ category: "setup", subject: "Hello there", message: "short" }, cats).errors.message !== undefined, true);
  const ok = validateNewRequest({ category: "setup", subject: "  Hello   there ", message: "  A long enough message " }, cats);
  assert.ok(ok.ok);
  assert.equal(ok.value.subject, "Hello there");
});

test("merge de-duplicates and sorts newest first", () => {
  const out = mergeRequests([req("a", 1), req("b", 2)], [req("a", 1, { status: "open" }), req("c", 3)]);
  assert.deepEqual(out.map((r) => r.id), ["c", "b", "a"]);
  assert.equal(out[2].status, "open");
});

test("replaceHead: a short head is the whole list; a full head keeps only older rows", () => {
  const existing = [req("a", 5), req("b", 4), req("c", 3)];
  assert.deepEqual(replaceHead(existing, [req("b", 4)], 50).map((r) => r.id), ["b"]);
  assert.deepEqual(replaceHead(existing, [req("z", 9), req("b", 4)], 2).map((r) => r.id), ["z", "b", "c"]);
});

test("cursor is the oldest createdAt", () => {
  assert.equal(nextCursor([req("a", 5), req("b", 2)]), 2);
  assert.equal(nextCursor([]), undefined);
});

test("thread is oldest first and local update appends the reply", () => {
  const r = req("a", 1, { responses: [{ at: 9, byDeskCode: "X", text: "late" }, { at: 3, byDeskCode: "Y", text: "early" }] });
  assert.deepEqual(sortedThread(r).map((t) => t.text), ["early", "late"]);
  const u = applyLocalUpdate(r, "answered", { at: 20, byDeskCode: "Z", text: "new" });
  assert.equal(u.status, "answered"); assert.equal(u.responses.length, 3);
  assert.equal(applyLocalUpdate(r, "closed", undefined).responses.length, 2);
});

test("timeAgo", () => {
  const now = 1_000_000_000_000;
  assert.equal(timeAgo(now - 10_000, now), "just now");
  assert.equal(timeAgo(now - 5 * 60_000, now), "5 min ago");
  assert.equal(timeAgo(now - 3 * 3_600_000, now), "3 h ago");
  assert.equal(timeAgo(now - 2 * 86_400_000, now), "2 d ago");
});
