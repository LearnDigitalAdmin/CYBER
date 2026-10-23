/** Public surface of the access module for other desk screens (kept free of the lazy screens). */
export { ActionOtpDialog } from "./ActionOtpDialog";
export type { ActionOtpDialogProps } from "./ActionOtpDialog";
export { useActiveSession, useActiveSessionDetail, useSessionView, useNow } from "./useActiveSession";
export { normalizeKenyaPhone, phoneProblem, sanitizePhoneInput, PHONE_MAX_INPUT_LENGTH } from "./phone";
