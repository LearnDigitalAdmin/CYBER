import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseService";

export interface ProfilePatch {
  name?: string;
  id?: string;
  phone?: string;
  altPhone?: string;
  shopName?: string;
  county?: string;
  constituency?: string;
  ward?: string;
  addressLine?: string;
  /** Email a verification link was just sent to (not verified yet). */
  pendingEmail?: string;
}

/** Texts a 6-digit code through the internal SMS provider. */
export const sendSignupOtp = async (phone: string): Promise<void> => {
  await httpsCallable<{ phone: string }, { ok: boolean }>(functions, "sendSignupOtp")({ phone });
};

/** Verifies the code; the server finds/creates the Firebase Auth user for that phone and returns a custom token. */
export const verifySignupOtp = async (phone: string, code: string): Promise<{ token: string; isNew: boolean }> => {
  const res = await httpsCallable<{ phone: string; code: string }, { token: string; isNew: boolean }>(
    functions,
    "verifySignupOtp"
  )({ phone, code });
  return res.data;
};

/** Creates agents/{uid} (PID from a server transaction) if it does not exist yet. */
export const ensureAgentProfile = async (): Promise<{ isNew: boolean; pId: string }> => {
  const res = await httpsCallable<undefined, { isNew: boolean; pId: string }>(functions, "ensureAgentProfile")();
  return res.data;
};

/** Saves editable profile fields; also syncs the Auth email into the profile once it is verified. */
export interface ProfileSaveResult {
  email: string;
  emailVerified: boolean;
  /** All required details are present. */
  profileComplete: boolean;
  /** Labels of the required details that are still missing. */
  missing: string[];
}

export const updateAgentProfile = async (patch: ProfilePatch): Promise<ProfileSaveResult> => {
  const res = await httpsCallable<ProfilePatch, ProfileSaveResult>(functions, "updateAgentProfile")(patch);
  return res.data;
};

/** Callable errors carry a readable message after "functions/..." normalisation. */
export const apiMessage = (err: unknown, fallback = "Something went wrong. Please try again."): string => {
  const m = (err as { message?: string } | null)?.message;
  return m && !/^internal$/i.test(m) ? m : fallback;
};
