import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { DESK_COLLECTIONS, DESK_REGION } from "../contract.js";
import { handleDeskEvent } from "./onDeskEvent.js";

/**
 * PAY's webhooks write a create-only desk_events row for every confirmed split charge. This turns each into a settled
 * commission ledger row (or reversal rows for a refund) and updates the customer's paid periods / first-purchase fields.
 * Idempotent (deterministic ledger ids), so a retry or a replayed event never double-counts.
 */
export const desk_onDeskEvent = onDocumentCreated(
  { document: `${DESK_COLLECTIONS.events}/{eventId}`, region: DESK_REGION, retry: true, timeoutSeconds: 120 },
  async (event) => {
    await handleDeskEvent(event.params.eventId, event.data?.data());
  },
);
