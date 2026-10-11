import { test } from "node:test";
import assert from "node:assert/strict";
import { DOC_MAX_BYTES } from "../contract.js";
import { DeskError } from "../errors.js";
import { docMetaId, docStoragePath, parseUpload, sniffContentType, uploadAllowed } from "./pure.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 ")]);
const PDF = Buffer.from("%PDF-1.7\n...");
const b64 = (b: Buffer) => b.toString("base64");
const throwsInvalid = (fn: () => unknown, re?: RegExp) => assert.throws(fn, (e: unknown) => e instanceof DeskError && e.code === "invalid_argument" && (!re || re.test(e.message)));

test("magic bytes: JPEG, PNG, WEBP, PDF recognised; everything else is not", () => {
  assert.equal(sniffContentType(JPEG), "image/jpeg"); assert.equal(sniffContentType(PNG), "image/png");
  assert.equal(sniffContentType(WEBP), "image/webp"); assert.equal(sniffContentType(PDF), "application/pdf");
  assert.equal(sniffContentType(Buffer.from("GIF89a....")), undefined); assert.equal(sniffContentType(Buffer.from("<html>")), undefined);
  assert.equal(sniffContentType(Buffer.from("RIFF....WAVE")), undefined); assert.equal(sniffContentType(Buffer.alloc(0)), undefined);
  assert.equal(sniffContentType(Buffer.from([0xff, 0xd8])), undefined);
});
test("a correct upload parses", () => {
  const u = parseUpload({ kind: "id_front", contentType: "image/png", dataBase64: b64(PNG) });
  assert.equal(u.kind, "id_front"); assert.equal(u.contentType, "image/png"); assert.equal(u.bytes.length, PNG.length);
});
test("claimed type must match the real bytes", () => {
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "image/png", dataBase64: b64(JPEG) }), /does not match/);
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "application/pdf", dataBase64: b64(Buffer.from("MZ not a pdf")) }), /not a valid/);
});
test("kind, content type, empty and malformed base64 are refused", () => {
  throwsInvalid(() => parseUpload({ kind: "passport", contentType: "image/png", dataBase64: b64(PNG) }));
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "image/gif", dataBase64: b64(PNG) }));
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "image/png", dataBase64: "" }), /empty/);
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "image/png", dataBase64: "@@@@" }));
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "image/png", dataBase64: 5 }));
});
test("size limit: exactly DOC_MAX_BYTES passes, one byte more is refused", () => {
  const body = (n: number) => Buffer.concat([JPEG, Buffer.alloc(n - JPEG.length, 7)]);
  assert.equal(parseUpload({ kind: "selfie", contentType: "image/jpeg", dataBase64: b64(body(DOC_MAX_BYTES)) }).bytes.length, DOC_MAX_BYTES);
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "image/jpeg", dataBase64: b64(body(DOC_MAX_BYTES + 1)) }), /too large/);
  throwsInvalid(() => parseUpload({ kind: "selfie", contentType: "image/jpeg", dataBase64: "A".repeat(DOC_MAX_BYTES * 2) }), /too large/);
});
test("who may upload and when replacing stops", () => {
  assert.equal(uploadAllowed("applied", false).ok, true); assert.equal(uploadAllowed("applied", true).ok, true); assert.equal(uploadAllowed("training", true).ok, true);
  assert.equal(uploadAllowed("certified", true).ok, false); assert.equal(uploadAllowed("active", true).ok, false);
  assert.equal(uploadAllowed("certified", false).ok, true);
  assert.equal(uploadAllowed("suspended", false).ok, false); assert.equal(uploadAllowed("closed", false).ok, false);
});
test("storage path and metadata id", () => {
  assert.equal(docStoragePath("u1", "id_back"), "desk-docs/u1/id_back"); assert.equal(docMetaId("u1", "id_back"), "u1_id_back");
});
