/**
 * Desk functions entry — codebase "desk" (firebase.json). Every published function name starts `desk_`.
 * Areas are auto-discovered (see loader.ts); there is no barrel to edit.
 */
import { setGlobalOptions } from "firebase-functions/v2";
import { DESK_REGION } from "./contract.js";
import { loadAreas } from "./loader.js";

setGlobalOptions({ region: DESK_REGION, maxInstances: 20 });
loadAreas(__dirname, exports as Record<string, unknown>);
