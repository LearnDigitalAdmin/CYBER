/**
 * Pure draft chunking. A saved draft is stored as chunks desk_tickets/{id}/draft/{0000…} of {index,total,json}: each chunk
 * holds at most 500 KB of the JSON text, and a draft may use at most 20 chunks. Chunks are cut on UTF-8 character
 * boundaries so every chunk is valid text and joining them restores the exact JSON.
 */
import { DeskError } from "../errors.js";

export const MAX_CHUNK_BYTES = 500 * 1024;
export const MAX_CHUNKS = 20;
export const MAX_DRAFT_BYTES = MAX_CHUNK_BYTES * MAX_CHUNKS;

export interface DraftChunk { index: number; total: number; json: string }
export const chunkId = (index: number): string => String(index).padStart(4, "0");

export function chunkDraft(payload: unknown): { chunks: DraftChunk[]; bytes: number } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new DeskError("invalid_argument", "The draft must be an object");
  let text: string | undefined;
  try { text = JSON.stringify(payload); } catch { throw new DeskError("invalid_argument", "The draft contains data that cannot be saved"); }
  if (typeof text !== "string") throw new DeskError("invalid_argument", "The draft contains data that cannot be saved");
  const buf = Buffer.from(text, "utf8");
  if (buf.length > MAX_DRAFT_BYTES) {
    throw new DeskError("invalid_argument",
      `This draft is too large (${(buf.length / 1_048_576).toFixed(1)} MB; the limit is ${(MAX_DRAFT_BYTES / 1_048_576).toFixed(1)} MB). Split it into smaller batches.`);
  }
  const parts: string[] = [];
  let start = 0;
  while (start < buf.length) {
    let end = Math.min(start + MAX_CHUNK_BYTES, buf.length);
    // never cut inside a multi-byte character: back up over UTF-8 continuation bytes (10xxxxxx)
    while (end < buf.length && end > start && (buf[end] & 0xc0) === 0x80) end--;
    parts.push(buf.subarray(start, end).toString("utf8"));
    start = end;
  }
  if (parts.length === 0) parts.push("");
  if (parts.length > MAX_CHUNKS) throw new DeskError("invalid_argument", "This draft is too large. Split it into smaller batches.");
  return { chunks: parts.map((json, index) => ({ index, total: parts.length, json })), bytes: buf.length };
}

/** Inverse of chunkDraft (used by the execution backend and by tests). Rejects an incomplete or inconsistent set. */
export function joinDraft(chunks: readonly DraftChunk[]): unknown {
  if (chunks.length === 0) throw new DeskError("not_found", "No draft saved for this ticket");
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  const total = sorted[0].total;
  if (sorted.length !== total || sorted.some((c, i) => c.index !== i || c.total !== total))
    throw new DeskError("failed_precondition", "The saved draft is incomplete");
  return JSON.parse(sorted.map((c) => c.json).join(""));
}
