/**
 * Bot-wide outbound sender: text, reply buttons, list messages and documents via the WhatsApp Cloud API.
 * Used by Landlord Watch and by every other flow (see utils/ui.ts). services/whatsapp.service.ts stays text-only.
 *
 * Meta limits enforced here: reply buttons max 3 (title 20), list rows max 10 (title 24, description 72,
 * button label 20), interactive body 1,024, text body 4,096, document caption 1,024.
 * Signed document URLs and message bodies are never logged.
 */

import axios from 'axios';
import { Outbound, SendResult, WaRow } from '../types/watch.types';
import { chunkText, truncate } from '../utils/watch.format';
import { typedKey } from '../utils/ui';
import { logger } from '../utils/logger';

export const META_WINDOW_CLOSED = 131047;
const BODY_LIMIT = 1024;
const TEXT_CHUNK = 3500;

export type CloudPost = (
  url: string,
  payload: unknown,
  headers: Record<string, string>
) => Promise<{ status: number; data: unknown }>;

export interface SenderDeps {
  post?: CloudPost;
  url?: () => string;
  headers?: () => Record<string, string>;
  /** Usage meter hook (the bot's existing outbound counter). */
  meter?: (ok: boolean) => void;
}

const defaultPost: CloudPost = async (url, payload, headers) => {
  const res = await axios.post(url, payload, { headers, timeout: 15_000, validateStatus: () => true });
  return { status: res.status, data: res.data };
};

const base = (to: string) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: to.replace(/\D/g, ''),
});

/** Split anything that would exceed Meta limits into sendable pieces (pure). */
export function expandOutbound(o: Outbound): Outbound[] {
  if (o.kind === 'text') return chunkText(o.text, TEXT_CHUNK).map((text) => ({ kind: 'text' as const, text }));

  if (o.kind === 'document') {
    return [{ ...o, caption: o.caption ? truncate(o.caption, BODY_LIMIT) : undefined }];
  }

  const out: Outbound[] = [];
  let body = o.body;
  if (body.length > BODY_LIMIT) {
    for (const text of chunkText(body, TEXT_CHUNK)) out.push({ kind: 'text', text });
    body = '👇';
  }
  if (o.kind === 'buttons') {
    out.push({
      kind: 'buttons',
      body,
      buttons: o.buttons.slice(0, 3).map((b) => ({ id: b.id.slice(0, 256), title: truncate(b.title, 20) })),
    });
  } else {
    out.push({
      kind: 'list',
      body,
      button: truncate(o.button, 20),
      rows: o.rows.slice(0, 10).map<WaRow>((r) => ({
        id: r.id.slice(0, 200),
        title: truncate(r.title, 24),
        ...(r.description ? { description: truncate(r.description, 72) } : {}),
      })),
    });
  }
  return out;
}

/** Cloud API payload for ONE already-expanded message (pure). */
export function buildCloudPayload(to: string, o: Outbound): Record<string, unknown> {
  switch (o.kind) {
    case 'text':
      return { ...base(to), type: 'text', text: { preview_url: false, body: o.text } };
    case 'buttons':
      return {
        ...base(to),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: o.body },
          action: { buttons: o.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
        },
      };
    case 'list':
      return {
        ...base(to),
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: o.body },
          action: { button: o.button, sections: [{ rows: o.rows }] },
        },
      };
    case 'document':
      return {
        ...base(to),
        type: 'document',
        document: { link: o.url, filename: o.filename, ...(o.caption ? { caption: o.caption } : {}) },
      };
  }
}

/**
 * Plain-text rendering of an interactive message (used when Meta rejects the interactive form). Each line is led by
 * what the user would TYPE to choose it: the ui value for the shared flows (`7. Landlord Watch`, `FULL. Pay full
 * amount`), the position for Landlord Watch (its handler maps typed numbers back to actions).
 */
export function toNumberedText(o: Outbound): string {
  if (o.kind === 'text') return o.text;
  if (o.kind === 'document') return o.caption ?? '';
  const items = o.kind === 'buttons' ? o.buttons : o.rows;
  const lines: string[] = [];
  items.forEach((it, i) => {
    const key = typedKey(it.id, i);
    if (key !== null) lines.push(`${key}. ${it.title}`);
  });
  return `${o.body}\n\n${lines.join('\n')}`;
}

function metaCode(data: unknown): number | undefined {
  const c = (data as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof c === 'number' ? c : undefined;
}

async function postOne(to: string, o: Outbound, deps: SenderDeps): Promise<SendResult> {
  const post = deps.post ?? defaultPost;
  try {
    const res = await post(deps.url?.() ?? '', buildCloudPayload(to, o), deps.headers?.() ?? {});
    const ok = res.status >= 200 && res.status < 300;
    deps.meter?.(ok);
    if (!ok) {
      const code = metaCode(res.data);
      logger.warn('WhatsApp send rejected', { kind: o.kind, status: res.status, metaCode: code });
      return { ok: false, errorCode: code };
    }
    return { ok: true };
  } catch (err) {
    const low = (err as { code?: unknown } | null)?.code;
    logger.warn('WhatsApp send error', { kind: o.kind, cause: typeof low === 'string' ? low : 'unknown' });
    deps.meter?.(false);
    return { ok: false };
  }
}

/**
 * Send one logical message. Long bodies are split; an interactive message Meta rejects falls back to numbered text
 * (typed numbers are mapped back to actions by the handler, so the user can still continue).
 */
export async function sendOutbound(to: string, o: Outbound, deps: SenderDeps): Promise<SendResult> {
  let last: SendResult = { ok: true };
  for (const piece of expandOutbound(o)) {
    last = await postOne(to, piece, deps);
    if (!last.ok && (piece.kind === 'buttons' || piece.kind === 'list') && last.errorCode !== META_WINDOW_CLOSED) {
      last = await postOne(to, { kind: 'text', text: toNumberedText(piece) }, deps);
    }
    if (!last.ok) return last;
  }
  return last;
}
