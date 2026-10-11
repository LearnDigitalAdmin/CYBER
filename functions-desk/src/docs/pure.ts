/** Registration-document validation. Pure: the claimed type must match the file's real magic bytes. */
import { DOC_CONTENT_TYPES, DOC_KINDS, DOC_MAX_BYTES, type DocKind } from "../contract.js";
import { DeskError } from "../errors.js";
import type { AgentStatus } from "../contract.js";

export type DocContentType = typeof DOC_CONTENT_TYPES[number];

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0): boolean => sig.every((v, i) => b[at + i] === v);

/** The type the bytes really are, or undefined for anything else. */
export function sniffContentType(b: Uint8Array): DocContentType | undefined {
  if (b.length >= 3 && startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (b.length >= 8 && startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (b.length >= 12 && startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (b.length >= 5 && startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return undefined;
}

export const isDocKind = (v: unknown): v is DocKind => typeof v === "string" && (DOC_KINDS as readonly string[]).includes(v);
export const isDocContentType = (v: unknown): v is DocContentType => typeof v === "string" && (DOC_CONTENT_TYPES as readonly string[]).includes(v);

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export interface ParsedUpload { kind: DocKind; contentType: DocContentType; bytes: Buffer }

/** Validates kind, declared type, size and magic bytes. Throws a user-readable DeskError. */
export function parseUpload(raw: { kind?: unknown; contentType?: unknown; dataBase64?: unknown }): ParsedUpload {
  if (!isDocKind(raw.kind)) throw new DeskError("invalid_argument", "Choose which document you are uploading");
  if (!isDocContentType(raw.contentType)) throw new DeskError("invalid_argument", "Upload a JPEG, PNG, WEBP or PDF file");
  const b64 = typeof raw.dataBase64 === "string" ? raw.dataBase64.replace(/\s+/g, "") : "";
  if (!b64) throw new DeskError("invalid_argument", "The file is empty");
  // Size is checked from the text length first so an oversized payload is never decoded.
  if (Math.floor((b64.length * 3) / 4) > DOC_MAX_BYTES + 3) throw new DeskError("invalid_argument", `The file is too large (max ${DOC_MAX_BYTES / 1024 / 1024} MB)`);
  if (b64.length % 4 !== 0 || !B64.test(b64)) throw new DeskError("invalid_argument", "The file could not be read. Try uploading it again.");
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length === 0) throw new DeskError("invalid_argument", "The file is empty");
  if (bytes.length > DOC_MAX_BYTES) throw new DeskError("invalid_argument", `The file is too large (max ${DOC_MAX_BYTES / 1024 / 1024} MB)`);
  const real = sniffContentType(bytes);
  if (!real) throw new DeskError("invalid_argument", "This is not a valid JPEG, PNG, WEBP or PDF file");
  if (real !== raw.contentType) throw new DeskError("invalid_argument", "The file type does not match the file you chose");
  return { kind: raw.kind, contentType: raw.contentType, bytes };
}

/** Suspended or closed desks cannot upload; once certified a document that already exists is locked. */
export function uploadAllowed(status: AgentStatus, alreadyUploaded: boolean): { ok: true } | { ok: false; message: string } {
  if (status === "suspended" || status === "closed") return { ok: false, message: `Your desk is ${status}. You cannot upload documents.` };
  if (alreadyUploaded && (status === "certified" || status === "active")) {
    return { ok: false, message: "Your documents are locked now that your desk is certified. Contact Samuhia support to change one." };
  }
  return { ok: true };
}

export const docStoragePath = (uid: string, kind: DocKind): string => `desk-docs/${uid}/${kind}`;
export const docMetaId = (uid: string, kind: DocKind): string => `${uid}_${kind}`;
