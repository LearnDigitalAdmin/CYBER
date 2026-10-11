import {
  TENANT_PAGE_SIZE, summaryExport,
  type DelegateExportPayload, type DelegateListTenantsPayload, type DelegateReportPayload, type ExportDataOut,
  type GetEntityInfoOut, type ListTenantsOut, type RunReportOut, type Scope,
} from "../contract.js";
import type { DeskConfig } from "../config.js";
import { col } from "../db.js";
import { DeskError } from "../errors.js";
import { audit } from "../kernel/audit.js";
import { requireActiveAgent } from "../kernel/agents.js";
import { requireSession } from "../kernel/session.js";
import type { ActionOtpDoc, AgentDoc, SessionContext } from "../types.js";
import type { Deps } from "../connectors/deps.js";
import { NOT_AUTHORISED_MESSAGE, assertEntityKey, lookupEntity } from "../connectors/entities.js";
import { record } from "../connectors/input.js";
import { NotPmsEntityError } from "./errors.js";
import {
  MAX_LINK_LIFETIME_MS, cleanCursor, cleanExportKind, cleanReportParams, cleanReportType, cleanTenantQuery, cleanTenantsPage,
  exportRequestId, normaliseEntityInfo, reportRequestId, requireOffered, validateFileResult,
} from "./pure.js";

interface Gate { d: Record<string, unknown>; sessionId: string; agent: AgentDoc; ctx: SessionContext; code: string; cfg: DeskConfig }

/** Shared opening of every workspace callable: active agent, then an active OTP-verified session that allows `scope`. */
async function open(deps: Deps, uid: string, raw: unknown, scope: Scope): Promise<Gate> {
  const d = record(raw);
  const sessionId = typeof d.sessionId === "string" ? d.sessionId : "";
  if (!sessionId) throw new DeskError("invalid_argument", "Session is required");
  const agent = await requireActiveAgent(uid);
  const ctx = await requireSession({ sessionId, uid, scope });
  const { code } = assertEntityKey(ctx.entityKey);
  return { d, sessionId, agent, ctx, code, cfg: await deps.getConfig() };
}

/** What the entity offers right now. The grant is re-checked: the customer may have removed this desk since the session began. */
async function currentInfo(deps: Deps, g: Gate): Promise<GetEntityInfoOut> {
  const { info, authorised } = await lookupEntity(deps, g.cfg, g.agent, g.ctx.product, g.code);
  if (!authorised) throw new DeskError("permission_denied", NOT_AUTHORISED_MESSAGE);
  return normaliseEntityInfo(info);
}

/** Runs a delegate call that may cost the customer credits or hand out data; a failure leaves its own audit row. */
async function audited<T>(g: Gate, failedAction: string, meta: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    await audit({
      action: failedAction, agentId: g.agent.agentId, entityKey: g.ctx.entityKey, sessionId: g.sessionId,
      meta: { ...meta, error: err instanceof DeskError ? err.message : "unexpected error" },
    }).catch(() => undefined);
    throw err;
  }
}

/** scope `read` -> what this customer's plan offers: audiences, report types, export kinds, SMS credits. */
export async function getEntityInfo(deps: Deps, uid: string, raw: unknown): Promise<GetEntityInfoOut> {
  const g = await open(deps, uid, raw, "read");
  const out = await currentInfo(deps, g);
  await audit({
    action: "entity_info_viewed", agentId: uid, entityKey: g.ctx.entityKey, sessionId: g.sessionId,
    meta: { audiences: out.audiences.length, reportTypes: out.reportTypes.length, exportKinds: out.exportKinds.length },
  });
  return out;
}

/** scope `report` -> the product's own report engine (it charges its own credits). Reports the entity does not offer never leave desk. */
export async function runReport(deps: Deps, uid: string, raw: unknown): Promise<RunReportOut> {
  const d = record(raw);
  const reportType = cleanReportType(d.reportType);
  const params = cleanReportParams(d.params);
  const g = await open(deps, uid, raw, "report");
  const info = await currentInfo(deps, g);
  requireOffered("report", reportType, info.reportTypes);

  const requestId = reportRequestId({ sessionId: g.sessionId, reportType, params, requestId: d.requestId, now: deps.now() });
  const meta = { reportType, paramKeys: Object.keys(params), requestId };
  const payload: DelegateReportPayload = { reportType, params };
  const result = await audited(g, "report_failed", meta, async () => validateFileResult(
    await deps.delegate<unknown>(g.cfg, g.ctx.product, {
      action: "run_report", entityCode: g.code, agentCode: g.agent.agentCode, requestId, payload: { ...payload },
    }), deps.now()));
  await audit({
    action: "report_run", agentId: uid, entityKey: g.ctx.entityKey, sessionId: g.sessionId,
    meta: { ...meta, linkLifetimeMs: result.expiresAt - deps.now(), linkWithinLimit: result.expiresAt - deps.now() <= MAX_LINK_LIFETIME_MS },
  });
  return result;
}

/**
 * scope `export` -> the product's export_data, authorised by an export OTP the customer approved for exactly this kind.
 * Every check that must not burn the one-time OTP runs first; the OTP is consumed only when the export is certain to be requested.
 */
export async function exportData(deps: Deps, uid: string, raw: unknown): Promise<ExportDataOut> {
  const d = record(raw);
  const kind = cleanExportKind(d.kind);
  const actionId = typeof d.actionId === "string" ? d.actionId : "";
  if (!actionId) throw new DeskError("invalid_argument", "Confirm this export with the customer's OTP first");
  const g = await open(deps, uid, raw, "export");
  const info = await currentInfo(deps, g);
  requireOffered("export", kind, info.exportKinds);

  const aSnap = await col("actionOtps").doc(actionId).get();
  const approved = aSnap.exists ? (aSnap.data() as ActionOtpDoc) : undefined;
  if (!approved) throw new DeskError("otp_required", "Confirm this export with the customer's OTP first");
  if (approved.action !== "export" || approved.summary !== summaryExport(kind)) {
    throw new DeskError("invalid_argument", "The confirmed request does not match this export. Ask the customer to confirm again.");
  }
  await requireSession({ sessionId: g.sessionId, uid, scope: "export", action: "export", actionId });

  const requestId = exportRequestId(actionId);
  const meta = { kind, actionId, requestId };
  const payload: DelegateExportPayload = { kind };
  const result = await audited(g, "export_failed", meta, async () => validateFileResult(
    await deps.delegate<unknown>(g.cfg, g.ctx.product, {
      action: "export_data", entityCode: g.code, agentCode: g.agent.agentCode, requestId, payload: { ...payload },
    }), deps.now()));
  await audit({ action: "data_exported", agentId: uid, entityKey: g.ctx.entityKey, sessionId: g.sessionId, meta });
  return result;
}

/** scope `rent_stk`, pms only -> one page of the landlord's tenants (masked phones) for picking who to prompt. */
export async function listTenants(deps: Deps, uid: string, raw: unknown): Promise<ListTenantsOut> {
  const d = record(raw);
  const query = cleanTenantQuery(d.query);
  const cursor = cleanCursor(d.cursor);
  const g = await open(deps, uid, raw, "rent_stk");
  if (g.ctx.product !== "pms") throw new NotPmsEntityError("Rent collection");

  const payload: DelegateListTenantsPayload = { limit: TENANT_PAGE_SIZE, ...(cursor ? { cursor } : {}), ...(query ? { query } : {}) };
  const page = cleanTenantsPage(await deps.delegate<unknown>(g.cfg, "pms", {
    action: "list_tenants", entityCode: g.code, agentCode: g.agent.agentCode, payload: { ...payload },
  }));
  await audit({
    action: "tenants_listed", agentId: uid, entityKey: g.ctx.entityKey, sessionId: g.sessionId,
    meta: { count: page.tenants.length, dropped: page.dropped, searched: Boolean(query), paged: Boolean(cursor) },
  });
  return { tenants: page.tenants, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) };
}
