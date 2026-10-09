import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAreas } from "./loader.js";

function area(root: string, rel: string, js: string): void {
  const dir = join(root, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.js"), js);
}

test("loads areas (including nested), publishes only desk_ exports, skips reserved folders", () => {
  const root = mkdtempSync(join(tmpdir(), "desk-loader-"));
  area(root, "tickets", 'exports.desk_a = () => 1; exports.helper = () => 2;');
  area(root, "connectors/chama", 'exports.desk_b = () => 3;');
  area(root, "kernel", 'exports.desk_should_not_load = () => 4;');
  const target: Record<string, unknown> = {};
  const loaded = loadAreas(root, target);
  assert.deepEqual(Object.keys(target).sort(), ["desk_a", "desk_b"]);
  assert.equal(loaded.length, 2);
});
test("duplicate function names across areas fail loudly", () => {
  const root = mkdtempSync(join(tmpdir(), "desk-loader-"));
  area(root, "one", 'exports.desk_same = () => 1;');
  area(root, "two", 'exports.desk_same = () => 2;');
  assert.throws(() => loadAreas(root, {}), /Duplicate desk function export/);
});
test("an empty tree loads nothing", () => {
  assert.deepEqual(loadAreas(mkdtempSync(join(tmpdir(), "desk-loader-")), {}), []);
});
