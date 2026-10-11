import { useEffect, useState } from "react";
import { watchTicket } from "../../api/watch";
import type { TicketView } from "../../api";

/** Live ticket. `undefined` until the first snapshot arrives; `null` when it is missing or cannot be read. */
export function useTicket(ticketId: string | null): TicketView | null | undefined {
  const [state, setState] = useState<{ id: string | null; ticket: TicketView | null | undefined }>({ id: null, ticket: undefined });
  useEffect(() => {
    if (!ticketId) return;
    return watchTicket(ticketId, (t) => setState({ id: ticketId, ticket: t }));
  }, [ticketId]);
  if (!ticketId) return null;
  return state.id === ticketId ? state.ticket : undefined;
}
