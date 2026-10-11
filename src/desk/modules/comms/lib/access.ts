/**
 * The one place the workspace modules import W1-D's access pieces from. Signatures (from the build prompts):
 *   ActionOtpDialog({ open, sessionId, action, summary, onVerified(actionId), onClose })
 *   useActiveSession(): { sessionId: string | null; entityKey: string | null }   (sessionStorage)
 * Comms, Reports and Rent are shared consumers of this folder; if W1-D ever moves these, fix it here only.
 */
export { ActionOtpDialog, useActiveSession } from "../../../access/ActionOtpDialog";
