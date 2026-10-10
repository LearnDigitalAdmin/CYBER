import type { ConfirmSupportIn, ConfirmSupportOut, LogSupportIn, LogSupportOut } from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { defaultDeps } from "../connectors/deps.js";
import { HP_SECRETS } from "../kernel/sms.js";
import { confirmSupport, logSupport } from "./handlers.js";

export const desk_logSupport = deskCallable<LogSupportIn, LogSupportOut>(
  { secrets: HP_SECRETS, timeoutSeconds: 120 },
  (uid, data) => logSupport(defaultDeps(), uid, data),
);
export const desk_confirmSupport = deskCallable<ConfirmSupportIn, ConfirmSupportOut>(
  {},
  (uid, data) => confirmSupport(defaultDeps(), uid, data),
);
