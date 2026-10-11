import { DeskApiError } from "../api/client";

/** The person-readable message from a desk call (server messages are already written for people). */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof DeskApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** Network-level failures: the customer's code was not judged, so they must not count as a wrong attempt. */
export function isTransientError(e: unknown): boolean {
  if (!(e instanceof DeskApiError)) return true;
  return e.code === "functions/unavailable" || e.code === "functions/deadline-exceeded"
    || e.code === "functions/unauthenticated" || e.code === "functions/internal" || e.code === "unknown";
}
