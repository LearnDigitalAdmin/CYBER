import { col } from "../db.js";
import type { AuditEntry } from "../types.js";

/** Append-only. Browsers can never write this collection (rules), and no desk code updates or deletes it. */
export async function audit(entry: AuditEntry): Promise<string> {
  const ref = col("audit").doc();
  await ref.create({ ...entry, meta: entry.meta ?? {}, at: Date.now() });
  return ref.id;
}
