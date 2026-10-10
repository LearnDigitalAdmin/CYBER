import type {
  EndSessionIn, EndSessionOut, InitiateRentStkIn, InitiateRentStkOut, RequestAccessIn, RequestAccessOut, VerifyAccessIn, VerifyAccessOut,
} from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { defaultDeps } from "../connectors/deps.js";
import { HP_SECRETS } from "../kernel/sms.js";
import { endSession, requestAccess, verifyAccess } from "./access.js";
import { initiateRentStk } from "./rent.js";

export const desk_requestAccess = deskCallable<RequestAccessIn, RequestAccessOut>(
  { secrets: HP_SECRETS, timeoutSeconds: 120 },
  (uid, data) => requestAccess(defaultDeps(), uid, data),
);
export const desk_verifyAccess = deskCallable<VerifyAccessIn, VerifyAccessOut>(
  { timeoutSeconds: 90 },
  (uid, data) => verifyAccess(defaultDeps(), uid, data),
);
export const desk_endSession = deskCallable<EndSessionIn, EndSessionOut>(
  {},
  (uid, data) => endSession(defaultDeps(), uid, data),
);
export const desk_initiateRentStk = deskCallable<InitiateRentStkIn, InitiateRentStkOut>(
  {},
  (uid, data) => initiateRentStk(defaultDeps(), uid, data),
);
