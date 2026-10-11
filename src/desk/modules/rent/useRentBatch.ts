import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../services/firebaseService";
import { DESK_COLLECTIONS } from "../../api";
import type { BatchResult, BatchStatus } from "./rentLogic";

export interface RentBatchLive { status: BatchStatus; tenantIds: string[]; results: BatchResult[]; updatedAt: number }
export type RentBatchState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; batch: RentBatchLive };

const STATUSES: readonly BatchStatus[] = ["requested", "processing", "done", "failed"];

/**
 * Live `desk_rent_batches/{id}`: desk writes it as `requested` and the payments service fills in each tenant's result.
 * Rules let an agent read only their own batches. A failed read is reported, not shown as an empty batch.
 */
export function useRentBatch(batchId: string): RentBatchState {
  const [live, setLive] = useState<RentBatchState>({ state: "loading" });
  useEffect(() => {
    setLive({ state: "loading" });
    return onSnapshot(
      doc(db, DESK_COLLECTIONS.rentBatches, batchId),
      (s) => {
        if (!s.exists()) { setLive({ state: "error", message: "We couldn't find this rent request." }); return; }
        const d = s.data() as Record<string, unknown>;
        const status = STATUSES.includes(d.status as BatchStatus) ? (d.status as BatchStatus) : "requested";
        const tenantIds = Array.isArray(d.tenantIds) ? d.tenantIds.filter((x): x is string => typeof x === "string") : [];
        const results = Array.isArray(d.results)
          ? (d.results as unknown[]).flatMap((r): BatchResult[] => {
              const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
              if (typeof o.tenantId !== "string" || (o.status !== "sent" && o.status !== "failed")) return [];
              return [{ tenantId: o.tenantId, status: o.status, ...(typeof o.reference === "string" ? { reference: o.reference } : {}), ...(typeof o.error === "string" ? { error: o.error } : {}) }];
            })
          : [];
        setLive({ state: "ready", batch: { status, tenantIds, results, updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0 } });
      },
      () => setLive({ state: "error", message: "We couldn't read the progress of this rent request. Check your connection." }),
    );
  }, [batchId]);
  return live;
}

const KEY = "desk.rent.lastBatch";
export interface SavedBatch { batchId: string; names: Record<string, string> }
/** Remembers the last batch for this tab so a refresh keeps following it. Storage can be unavailable; that is fine. */
export function saveBatch(b: SavedBatch): void { try { sessionStorage.setItem(KEY, JSON.stringify(b)); } catch { /* private mode */ } }
export function loadBatch(): SavedBatch | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedBatch>;
    return typeof v.batchId === "string" && v.names && typeof v.names === "object" ? { batchId: v.batchId, names: v.names } : null;
  } catch { return null; }
}
export function clearBatch(): void { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }
