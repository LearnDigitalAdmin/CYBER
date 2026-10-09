export type DeskErrorCode =
  | "unauthenticated" | "permission_denied" | "session_invalid"
  | "otp_required" | "otp_invalid" | "not_found" | "invalid_argument"
  | "failed_precondition" | "already_exists" | "payment_failed" | "internal";

export class DeskError extends Error {
  readonly code: DeskErrorCode;
  constructor(code: DeskErrorCode, message: string) {
    super(message);
    this.name = "DeskError";
    this.code = code;
  }
}

/** Map to the HttpsError code strings used by firebase-functions. */
export function httpsCodeFor(code: DeskErrorCode):
  "unauthenticated" | "permission-denied" | "not-found" | "invalid-argument"
  | "failed-precondition" | "already-exists" | "internal" {
  switch (code) {
    case "unauthenticated": return "unauthenticated";
    case "permission_denied": case "session_invalid": case "otp_required": case "otp_invalid":
      return "permission-denied";
    case "not_found": return "not-found";
    case "invalid_argument": return "invalid-argument";
    case "failed_precondition": case "payment_failed": return "failed-precondition";
    case "already_exists": return "already-exists";
    default: return "internal";
  }
}
