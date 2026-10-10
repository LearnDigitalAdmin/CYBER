import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { DeskError, httpsCodeFor } from "../errors.js";

/** DeskError -> HttpsError with a user-readable message; anything unexpected is logged and hidden behind a generic message. */
export function toHttpsError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof DeskError) return new HttpsError(httpsCodeFor(err.code), err.message);
  logger.error("desk callable failed", err);
  return new HttpsError("internal", "Something went wrong. Please try again.");
}

/** Wraps a handler `(uid, data) => result` as a callable body that requires a signed-in caller. */
export function deskCallable<I, O>(handler: (uid: string, data: I) => Promise<O>): (req: CallableRequest<I>) => Promise<O> {
  return async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Please sign in");
    try {
      return await handler(uid, req.data);
    } catch (err) {
      throw toHttpsError(err);
    }
  };
}
