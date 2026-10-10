import { onSchedule } from "firebase-functions/v2/scheduler";
import { DESK_REGION } from "../contract.js";
import { evaluateMilestones } from "./evaluate.js";

/** Daily 03:00 Nairobi: one `payable` KES 2,000 bonus per new block of 10 retained paying chama/PMS accounts. Never pays anything out. */
export const desk_evaluateMilestones = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Africa/Nairobi", region: DESK_REGION, timeoutSeconds: 540, memory: "512MiB" },
  async () => { await evaluateMilestones(); },
);
