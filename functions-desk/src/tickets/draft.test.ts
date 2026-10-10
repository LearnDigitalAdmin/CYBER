import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkDraft, chunkId, joinDraft, MAX_CHUNKS, MAX_CHUNK_BYTES } from "./draft.js";

test("small drafts are one chunk and round-trip", () => {
  const p = { rows: [{ a: 1 }, { a: 2 }], source: "excel" };
  const { chunks } = chunkDraft(p);
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0], { index: 0, total: 1, json: JSON.stringify(p) });
  assert.deepEqual(joinDraft(chunks), p);
});

test("large drafts split at <= 500 KB and join back exactly, including multi-byte text", () => {
  const rows = Array.from({ length: 30000 }, (_, i) => ({ n: `Wanjiku Ñandi 🙂 ${i}`, v: "x".repeat(40) }));
  const { chunks, bytes } = chunkDraft({ rows });
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(Buffer.byteLength(c.json) <= MAX_CHUNK_BYTES);
  assert.equal(chunks.reduce((s, c) => s + Buffer.byteLength(c.json), 0), bytes);
  assert.deepEqual(joinDraft(chunks), { rows });
  chunks.forEach((c, i) => { assert.equal(c.index, i); assert.equal(c.total, chunks.length); });
});

test("a draft over 20 chunks is refused with a clear message", () => {
  assert.throws(() => chunkDraft({ blob: "y".repeat(MAX_CHUNK_BYTES * MAX_CHUNKS) }), /too large/);
});

test("only plain objects are drafts", () => {
  for (const bad of [null, [], "x", 5, undefined]) assert.throws(() => chunkDraft(bad), /must be an object/);
});

test("chunk ids are zero padded and incomplete sets are rejected", () => {
  assert.equal(chunkId(0), "0000"); assert.equal(chunkId(19), "0019");
  assert.throws(() => joinDraft([]), /No draft/);
  assert.throws(() => joinDraft([{ index: 1, total: 2, json: "{}" }]), /incomplete/);
});
