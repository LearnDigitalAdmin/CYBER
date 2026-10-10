import { DESK_TOP_CODE, type DelegateEntityInfo, type EntityKey, type Product } from "../contract.js";
import { DeskError } from "../errors.js";
import { parseEntityKey } from "../entity.js";
import type { AgentDoc } from "../types.js";
import { normalizeKenyaPhone } from "../paystack/phone.js";
import type { DeskConfig } from "../config.js";
import type { Deps } from "./deps.js";

const CHAMA_CODE = /^SMC-\d{4,}$/;
const PMS_CODE = /^PYL-\d{4,}$/;
/** KNEC centre codes are 8 digits. */
const SCHOOL_CODE = /^\d{8}$/;

export const BAD_CODE_MESSAGE =
  "That customer code isn't recognised. Use SMC-0000 for a chama, the 8-digit KNEC code for a school, or PYL-0000 for a landlord.";
export const NOT_AUTHORISED_MESSAGE = "Ask the customer to add your desk code under Settings → Support Agents";

/** Code -> product by shape; any other shape is rejected. Pure. */
export function classifyEntityCode(raw: string): { product: Product; code: string } {
  const code = (raw ?? "").trim().toUpperCase();
  if (CHAMA_CODE.test(code)) return { product: "chama", code };
  if (PMS_CODE.test(code)) return { product: "pms", code };
  if (SCHOOL_CODE.test(code)) return { product: "school", code };
  throw new DeskError("invalid_argument", BAD_CODE_MESSAGE);
}

/** Entity key from a client: it must parse AND its code must have the shape of its product. */
export function assertEntityKey(entityKey: string): { product: Product; code: string; entityKey: EntityKey } {
  if (typeof entityKey !== "string") throw new DeskError("invalid_argument", BAD_CODE_MESSAGE);
  const parsed = parseEntityKey(entityKey.trim());
  const found = classifyEntityCode(parsed.code);
  if (found.product !== parsed.product) throw new DeskError("invalid_argument", BAD_CODE_MESSAGE);
  return { product: parsed.product, code: found.code, entityKey: `${parsed.product}:${found.code}` };
}

/** `desk_customers` doc id for an entity key (identical to the kernel's getCustomer). */
export const customerDocId = (entityKey: string): string => entityKey.replace(/\//g, "_");

export const isTopDesk = (agent: Pick<AgentDoc, "agentCode">): boolean => agent.agentCode === DESK_TOP_CODE;

export interface EntityLookup { info: DelegateEntityInfo; authorised: boolean }

/** Asks the product (entity_info) and decides whether this desk is authorised. COG-0000 is authorised on every entity. */
export async function lookupEntity(
  deps: Deps, cfg: DeskConfig, agent: Pick<AgentDoc, "agentCode">, product: Product, code: string,
): Promise<EntityLookup> {
  const info = await deps.delegate<DelegateEntityInfo>(cfg, product, {
    action: "entity_info", entityCode: code, agentCode: agent.agentCode, payload: {},
  });
  return { info, authorised: isTopDesk(agent) || info.agentAuthorised === true };
}

export function adminPhoneE164(info: DelegateEntityInfo): string {
  try { return normalizeKenyaPhone(info.adminPhone ?? ""); } catch {
    throw new DeskError("failed_precondition", "This customer has no valid admin phone number on file");
  }
}

/** True when the agent's own phone is the customer admin's (self-owned accounts are refused). */
export function isSameNumber(agentPhone: string, adminE164: string): boolean {
  try { return normalizeKenyaPhone(agentPhone) === adminE164; } catch { return false; }
}
