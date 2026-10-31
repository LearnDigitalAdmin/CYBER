// Regenerates functions-desk/src/network/geo.data.ts from the frontend's address dataset. `--check` fails if they differ (use in CI).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const SRC = "src/data/kenyaAdmin.json";
const DST = "functions-desk/src/network/geo.data.ts";
const data = JSON.parse(readFileSync(SRC, "utf8"));
const want = [
  "// GENERATED from src/data/kenyaAdmin.json by scripts/sync-kenya-admin.mjs. DO NOT EDIT.",
  "// Compact: n = name, k = constituencies, w = wards (the same shape the signup address pickers use).",
  "export interface KenyaConstituency { n: string; w: string[] }",
  "export interface KenyaCounty { n: string; k: KenyaConstituency[] }",
  `export const KENYA_ADMIN: readonly KenyaCounty[] = ${JSON.stringify(data)};`, "",
].join("\n");
if (process.argv.includes("--check")) {
  const have = existsSync(DST) ? readFileSync(DST, "utf8") : "";
  if (have !== want) { console.error("kenya admin data out of sync. Run: node scripts/sync-kenya-admin.mjs"); process.exit(1); }
  console.log("kenya admin data in sync");
} else { writeFileSync(DST, want); console.log("wrote", DST); }
