import type { ImportRow } from "../../api";

/** Callable requests are capped at 10 MB; stay well inside it. */
export const MAX_PAYLOAD_BYTES = 8_000_000;

/** The draft shape the executor commits (mirrors DelegateCommitPayload in the contract). */
export interface CommitDraft { rows: ImportRow[]; source: "excel" | "manual"; [k: string]: unknown }

export function buildDraft(rows: ImportRow[], source: CommitDraft["source"]): CommitDraft {
  return { rows, source };
}

export function payloadBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** null when the payload fits, otherwise a message for the agent. */
export function payloadProblem(value: unknown): string | null {
  return payloadBytes(value) > MAX_PAYLOAD_BYTES
    ? "This is too much data to send at once. Split it into smaller batches and do them one after the other."
    : null;
}
