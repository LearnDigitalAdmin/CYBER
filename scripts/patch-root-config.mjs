// Idempotent. Brings the repo's ROOT config up to what the desk kernel needs, whatever commit the repo is on.
// Safe to run any number of times. It never edits source files; it only reports on the one route mount it needs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const log = (m) => console.log(m);
let changed = 0;

// ---- package.json: scripts + the Excel dependency
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = {
  "desk:sync-contract": "node scripts/sync-desk-contract.mjs",
  "desk:check-contract": "node scripts/sync-desk-contract.mjs --check",
  "desk:test": "npm --prefix functions-desk test",
  "desk:test:emu": 'firebase emulators:exec --only firestore --project demo-desk "npm --prefix functions-desk test"',
};
pkg.scripts = pkg.scripts ?? {};
for (const [k, v] of Object.entries(scripts)) if (pkg.scripts[k] !== v) { pkg.scripts[k] = v; changed++; log(`package.json: set script ${k}`); }
pkg.dependencies = pkg.dependencies ?? {};
if (!pkg.dependencies["read-excel-file"]) { pkg.dependencies["read-excel-file"] = "^5.8.8"; changed++; log("package.json: added read-excel-file (run npm install)"); }
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

// ---- firebase.json: the separate "desk" Functions codebase + Firestore emulator
const fb = JSON.parse(readFileSync("firebase.json", "utf8"));
let fns = fb.functions;
if (!Array.isArray(fns)) { fns = fns ? [fns] : []; changed++; log("firebase.json: converted functions to an array"); }
if (!fns.some((f) => f.codebase === "desk")) {
  fns.push({ source: "functions-desk", codebase: "desk", ignore: ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log", "*.local"], predeploy: ['npm --prefix "$RESOURCE_DIR" run build'] });
  changed++; log('firebase.json: added Functions codebase "desk"');
}
for (const f of fns) if (!f.codebase) { f.codebase = "default"; changed++; log('firebase.json: gave the existing functions entry codebase "default"'); }
fb.functions = fns;
fb.emulators = fb.emulators ?? {};
if (!fb.emulators.firestore) { fb.emulators.firestore = { port: 8080 }; changed++; log("firebase.json: added Firestore emulator"); }
writeFileSync("firebase.json", JSON.stringify(fb, null, 2) + "\n");

// ---- report (never edit) the route mount
const routes = "src/routes/AppRoutes.tsx";
if (existsSync(routes)) {
  const src = readFileSync(routes, "utf8");
  const ok = src.includes("desk/core/DeskApp") && src.includes('path="/desk/*"');
  log(ok ? "AppRoutes.tsx: /desk mount present" : 'AppRoutes.tsx: MISSING the /desk mount. Add: import DeskApp from "../desk/core/DeskApp"; and <Route path="/desk/*" element={<ProtectedRoute><DeskApp /></ProtectedRoute>} />');
} else log("AppRoutes.tsx not found: adjust the mount for this repo's router");

log(changed ? `done: ${changed} change(s)` : "already up to date");
