/** Live Firestore views the UI reads directly (security rules allow only the signed-in agent's own documents). */
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../services/firebaseService";
import { DESK_COLLECTIONS } from "./contract";
import type { AgentView, LedgerEntryView, SessionView, TicketView } from "./contract";

type Unsub = () => void;

export function watchAgent(uid: string, cb: (a: AgentView | null) => void): Unsub {
  return onSnapshot(doc(db, DESK_COLLECTIONS.agents, uid),
    (s) => cb(s.exists() ? ({ ...(s.data() as Omit<AgentView, "agentId">), agentId: s.id }) : null),
    () => cb(null));
}
export function watchTicket(ticketId: string, cb: (t: TicketView | null) => void): Unsub {
  return onSnapshot(doc(db, DESK_COLLECTIONS.tickets, ticketId),
    (s) => cb(s.exists() ? ({ ...(s.data() as Omit<TicketView, "ticketId">), ticketId: s.id }) : null),
    () => cb(null));
}
export function watchSession(sessionId: string, cb: (s: SessionView | null) => void): Unsub {
  return onSnapshot(doc(db, DESK_COLLECTIONS.sessions, sessionId),
    (s) => cb(s.exists() ? ({ ...(s.data() as Omit<SessionView, "sessionId">), sessionId: s.id }) : null),
    () => cb(null));
}
export function watchLedger(agentId: string, cb: (rows: LedgerEntryView[]) => void, max = 100): Unsub {
  const q = query(collection(db, DESK_COLLECTIONS.ledger), where("agentId", "==", agentId), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<LedgerEntryView, "entryId">), entryId: d.id }))), () => cb([]));
}
