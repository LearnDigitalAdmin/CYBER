/**
 * Live reads for earnings. Both report a failed read instead of quietly returning an empty list (watchLedger does the latter),
 * so the screen can tell "no earnings yet" from "could not load".
 */
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../services/firebaseService";
import { DESK_COLLECTIONS, type LedgerKind, type LedgerStatus, type Product } from "../api/contract";
import { CYBER_WINDOW, LEDGER_WINDOW, type CyberIncomeRow, type LedgerRow } from "./model";

type Unsub = () => void;

export function subscribeLedger(agentId: string, cb: (rows: LedgerRow[], truncated: boolean) => void, onError: () => void): Unsub {
  const q = query(collection(db, DESK_COLLECTIONS.ledger), where("agentId", "==", agentId), orderBy("createdAt", "desc"), limit(LEDGER_WINDOW));
  return onSnapshot(q, (s) => {
    const rows: LedgerRow[] = s.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        entryId: d.id, kind: x.kind as LedgerKind, amountMinor: typeof x.amountMinor === "number" ? x.amountMinor : 0, status: x.status as LedgerStatus,
        ...(typeof x.product === "string" ? { product: x.product as Product } : {}),
        ...(typeof x.entityKey === "string" ? { entityKey: x.entityKey } : {}),
        ...(typeof x.note === "string" ? { note: x.note } : {}),
        ...(typeof x.paystackRef === "string" ? { paystackRef: x.paystackRef } : {}),
        createdAt: typeof x.createdAt === "number" ? x.createdAt : 0,
        ...(typeof x.paidAt === "number" ? { paidAt: x.paidAt } : {}),
      };
    });
    cb(rows, s.size >= LEDGER_WINDOW);
  }, onError);
}

/** PAY's `agents/{uid}/cyber-income` (successful payments only; same query the Income tab has always used). */
export function subscribeCyberIncome(agentId: string, cb: (rows: CyberIncomeRow[], truncated: boolean) => void, onError: () => void): Unsub {
  const q = query(collection(db, "agents", agentId, "cyber-income"), where("status", "==", "success"), orderBy("paidAt", "desc"), limit(CYBER_WINDOW));
  return onSnapshot(q, (s) => {
    const rows: CyberIncomeRow[] = s.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      const paid = x.paidAt as { toMillis?: () => number } | undefined;
      return {
        reference: d.id, service: typeof x.service === "string" ? x.service : "",
        agentNetIncomeKes: typeof x.agentNetIncome === "number" && Number.isFinite(x.agentNetIncome) ? x.agentNetIncome : 0,
        paidAt: typeof paid?.toMillis === "function" ? paid.toMillis() : 0,
      };
    });
    cb(rows, s.size >= CYBER_WINDOW);
  }, onError);
}
