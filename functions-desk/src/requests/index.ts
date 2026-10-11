import { onSchedule } from "firebase-functions/v2/scheduler";
import type {
  CreateRequestIn, CreateRequestOut, ListRequestsIn, ListRequestsOut, UpdateRequestIn, UpdateRequestOut,
} from "../contract.js";
import { DESK_REGION } from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { HP_SECRETS } from "../kernel/sms.js";
import { defaultRequestsDeps } from "./deps.js";
import { createRequest, listRequests, updateRequest } from "./handlers.js";
import { sweepRequests } from "./sweep.js";

const SWEEP_BUDGET_MS = 240_000;

/** Every 30 minutes: pulls product outboxes, pushes the public config, retries write-backs. Idempotent end to end. */
export const desk_sweepRequests = onSchedule(
  { schedule: "every 30 minutes", region: DESK_REGION, timeoutSeconds: 300, memory: "512MiB" },
  async () => { await sweepRequests(defaultRequestsDeps(), SWEEP_BUDGET_MS); },
);

export const desk_listRequests = deskCallable<ListRequestsIn, ListRequestsOut>({}, (uid, data) => listRequests(uid, data));

export const desk_updateRequest = deskCallable<UpdateRequestIn, UpdateRequestOut>(
  { secrets: HP_SECRETS, timeoutSeconds: 90 },
  (uid, data) => updateRequest(defaultRequestsDeps(), uid, data),
);

export const desk_createRequest = deskCallable<CreateRequestIn, CreateRequestOut>(
  {}, (uid, data) => createRequest(defaultRequestsDeps(), uid, data),
);
