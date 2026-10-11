import type { SyncEmailIn, SyncEmailOut } from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { defaultAccountDeps, syncEmail } from "./handlers.js";

export const desk_syncEmail = deskCallable<SyncEmailIn, SyncEmailOut>({}, (uid) => syncEmail(defaultAccountDeps(), uid));
