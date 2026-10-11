import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../../services/firebaseService";
import { DESK_COLLECTIONS } from "../../api";
import { toSupportItem, type SupportItem } from "./supportLogic";

export type SupportItemsState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; items: SupportItem[] };

/** This desk's support visits, newest first, live. Rules let an agent read only their own. */
export function useSupportItems(agentId: string, max = 50): SupportItemsState {
  const [live, setLive] = useState<SupportItemsState>({ state: "loading" });
  useEffect(() => {
    setLive({ state: "loading" });
    const q = query(collection(db, DESK_COLLECTIONS.support), where("agentId", "==", agentId), orderBy("createdAt", "desc"), limit(max));
    return onSnapshot(
      q,
      (s) => setLive({ state: "ready", items: s.docs.map((d) => toSupportItem(d.id, d.data() as Record<string, unknown>)) }),
      () => setLive({ state: "error", message: "We couldn't load your support visits. Check your connection and try again." }),
    );
  }, [agentId, max]);
  return live;
}
