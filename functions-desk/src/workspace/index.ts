import type {
  ExportDataIn, ExportDataOut, GetEntityInfoIn, GetEntityInfoOut, ListTenantsIn, ListTenantsOut, RunReportIn, RunReportOut,
} from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { exportData, getEntityInfo, listTenants, runReport } from "./handlers.js";
import { workspaceDeps } from "./delegate.js";

/** Report and export engines can take a while; the delegate call is cut off before the function itself is. */
const SLOW = { timeoutSeconds: 120 } as const;
const SLOW_DELEGATE_MS = 100_000;

export const desk_getEntityInfo = deskCallable<GetEntityInfoIn, GetEntityInfoOut>(
  {}, (uid, data) => getEntityInfo(workspaceDeps(), uid, data));
export const desk_runReport = deskCallable<RunReportIn, RunReportOut>(
  SLOW, (uid, data) => runReport(workspaceDeps(SLOW_DELEGATE_MS), uid, data));
export const desk_exportData = deskCallable<ExportDataIn, ExportDataOut>(
  SLOW, (uid, data) => exportData(workspaceDeps(SLOW_DELEGATE_MS), uid, data));
export const desk_listTenants = deskCallable<ListTenantsIn, ListTenantsOut>(
  {}, (uid, data) => listTenants(workspaceDeps(), uid, data));
