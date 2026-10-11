import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { DeskError, httpsCodeFor } from "../errors.js";
import type { AuthLike } from "../kernel/topdesk.js";

type SecretParam = ReturnType<typeof defineSecret>;

/**
 * Top-desk callable. The handler receives the caller's Auth identity and starts with requireTopDesk (verified
 * @samuhia.co.ke, recent sign-in, COG-0000 record): privileges live in code, never in rules.
 */
export function topCallable<I, O>(opts: { secrets?: SecretParam[]; timeoutSeconds?: number }, handler: (auth: AuthLike, data: I) => Promise<O>) {
  return onCall({ secrets: opts.secrets ?? [], timeoutSeconds: opts.timeoutSeconds ?? 60 }, async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in");
    try {
      return await handler({ uid: req.auth.uid, token: req.auth.token }, req.data as I);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (err instanceof DeskError) throw new HttpsError(httpsCodeFor(err.code), err.message);
      console.error("desk top callable failed", err);
      throw new HttpsError("internal", "Something went wrong. Please try again.");
    }
  });
}
