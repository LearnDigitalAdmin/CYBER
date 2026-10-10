import type {
  DelegateValidateResult, ImportRow, ResolveEntityOut, ValidateImportOut,
} from "../contract.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireActiveAgent } from "../kernel/agents.js";
import { requireSession } from "../kernel/session.js";
import { maskPhone } from "../paystack/phone.js";
import type { Deps } from "./deps.js";
import { adminPhoneE164, assertEntityKey, classifyEntityCode, lookupEntity } from "./entities.js";
import { record } from "./input.js";

/** Code -> product -> entity_info via the product's delegate. Never returns the full admin phone. */
export async function resolveEntity(deps: Deps, uid: string, raw: unknown): Promise<ResolveEntityOut> {
  const d = record(raw);
  const { product, code } = classifyEntityCode(typeof d.code === "string" ? d.code : "");
  const agent = await requireActiveAgent(uid);
  const cfg = await deps.getConfig();
  const { info, authorised } = await lookupEntity(deps, cfg, agent, product, code);
  const out: ResolveEntityOut = {
    entityKey: `${product}:${code}`, product, displayName: info.displayName,
    adminPhoneMasked: maskPhone(adminPhoneE164(info)), agentHasGrant: authorised,
  };
  await audit({ action: "entity_resolved", agentId: uid, entityKey: out.entityKey, meta: { authorised } });
  return out;
}

export const MAX_IMPORT_ROWS = 5000;

/** scope `import` -> the product's own validate_records; its errors are passed through unchanged. */
export async function validateImport(deps: Deps, uid: string, raw: unknown): Promise<ValidateImportOut> {
  const d = record(raw);
  const sessionId = typeof d.sessionId === "string" ? d.sessionId : "";
  if (!sessionId) throw new DeskError("invalid_argument", "Session is required");
  const rows = d.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new DeskError("invalid_argument", "There are no rows to check");
  if (rows.length > MAX_IMPORT_ROWS) throw new DeskError("invalid_argument", `Too many rows (${rows.length}). Split the file into parts of at most ${MAX_IMPORT_ROWS}.`);
  if (rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) throw new DeskError("invalid_argument", "Every row must be a set of columns");

  const agent = await requireActiveAgent(uid);
  const ctx = await requireSession({ sessionId, uid, scope: "import" });
  const { code } = assertEntityKey(ctx.entityKey);
  const cfg = await deps.getConfig();
  const result = await deps.delegate<DelegateValidateResult>(cfg, ctx.product, {
    action: "validate_records", entityCode: code, agentCode: agent.agentCode,
    payload: { rows: rows as ImportRow[] },
  });
  await audit({
    action: "import_validated", agentId: uid, entityKey: ctx.entityKey, sessionId,
    meta: { rows: rows.length, valid: result.valid.length, errors: result.errors.length },
  });
  return { valid: result.valid, errors: result.errors };
}
