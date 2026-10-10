import type { RequestActionOtpIn, RequestActionOtpOut, VerifyActionOtpIn, VerifyActionOtpOut } from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { defaultDeps } from "../connectors/deps.js";
import { HP_SECRETS } from "../kernel/sms.js";
import { requestActionOtp, verifyActionOtp } from "./handlers.js";

export const desk_requestActionOtp = deskCallable<RequestActionOtpIn, RequestActionOtpOut>(
  { secrets: HP_SECRETS, timeoutSeconds: 120 },
  (uid, data) => requestActionOtp(defaultDeps(), uid, data),
);

export const desk_verifyActionOtp = deskCallable<VerifyActionOtpIn, VerifyActionOtpOut>(
  {},
  (uid, data) => verifyActionOtp(defaultDeps(), uid, data),
);
