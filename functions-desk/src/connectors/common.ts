import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
type SecretParam = ReturnType<typeof defineSecret>;
import { DeskError, httpsCodeFor } from "../errors.js";

export interface CallableOptions { secrets?: SecretParam[]; timeoutSeconds?: number }
type AuthToken = NonNullable<CallableRequest["auth"]>["token"];

/**
 * Wraps a handler as a callable: requires sign-in, maps DeskError to the right HttpsError and never leaks internals.
 * Handlers get the caller's uid and Auth token; privileges are enforced inside them (requireActiveAgent / requireSession).
 */
export function deskCallable<I, O>(
  opts: CallableOptions,
  handler: (uid: string, data: I, token: AuthToken) => Promise<O>,
) {
  return onCall({ secrets: opts.secrets ?? [], timeoutSeconds: opts.timeoutSeconds ?? 60 }, async (req: CallableRequest<I>) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in");
    try {
      return await handler(req.auth.uid, req.data, req.auth.token);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (err instanceof DeskError) throw new HttpsError(httpsCodeFor(err.code), err.message);
      console.error("desk callable failed", err);
      throw new HttpsError("internal", "Something went wrong. Please try again.");
    }
  });
}
