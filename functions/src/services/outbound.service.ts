/**
 * Production wiring for sending a handler's `Reply` (see utils/ui.ts): stamps the real session state into the
 * interactive ids, then sends each message in order through the Cloud API sender.
 */

import { getWhatsAppApiUrl, getWhatsAppHeaders } from '../config/whatsapp.config';
import { recordWhatsAppUsage } from '../utils/whatsapp.usage';
import { needsState, Reply, stampReply } from '../utils/ui';
import { getSession } from './session.service';
import { formatPhoneForWhatsApp } from './whatsapp.service';
import { sendOutbound, SenderDeps } from './wa.sender';

export const cloudSenderDeps = (): SenderDeps => ({
  url: getWhatsAppApiUrl,
  headers: getWhatsAppHeaders,
  meter: (ok) => recordWhatsAppUsage({ kind: 'outbound', ok }),
});

/**
 * @param fallbackState used for stamping when the session cannot be re-read (it is the state the message arrived in).
 * Stops at the first message that fails (for example Meta's 24 h window): later ones would only fail too.
 */
export async function sendReply(phone: string, reply: Reply, fallbackState: string): Promise<void> {
  // Handlers move the session on before replying, so the state to stamp is read AFTER the handler ran.
  const state = needsState(reply) ? ((await getSession(phone))?.currentState ?? fallbackState) : fallbackState;
  const to = formatPhoneForWhatsApp(phone);
  for (const o of stampReply(reply, state)) {
    const res = await sendOutbound(to, o, cloudSenderDeps());
    if (!res.ok) return;
  }
}
