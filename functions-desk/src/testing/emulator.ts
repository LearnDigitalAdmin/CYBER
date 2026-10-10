/**
 * Helpers for Firestore-emulator tests. Run them with:  npm run desk:test:emu   (needs Java + firebase-tools).
 * Without the emulator, tests guarded by `emulatorEnabled` are reported as skipped, never as passed.
 */
export const emulatorEnabled: boolean = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

/** Wipes every document in the emulator so each test starts clean. Refuses to run against anything else. */
export async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const project = process.env.GCLOUD_PROJECT ?? "demo-desk";
  if (!host) throw new Error("clearFirestore only runs against the Firestore emulator");
  const res = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not clear the emulator: HTTP ${res.status}`);
}
