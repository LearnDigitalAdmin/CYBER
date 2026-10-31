import type { ApplyAgentIn, ApplyAgentOut } from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { applyAgent } from "./apply.js";

export const desk_applyAgent = deskCallable<ApplyAgentIn, ApplyAgentOut>(
  {},
  (uid, data, token) => applyAgent(uid, token.email, data, Date.now(), { emailVerified: token.email_verified === true, tokenPhone: typeof token.phone_number === "string" ? token.phone_number : undefined }),
);
