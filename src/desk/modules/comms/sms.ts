/** Live SMS length and segment counting (GSM 03.38). Pure; no imports so it runs under node's test runner as well as Vite. */
const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€\f";
const BASIC = new Set(GSM_BASIC);
const EXTENDED = new Set(GSM_EXTENDED);

/** The longest message the desk accepts (HostPinnacle's single-message limit, enforced server-side too). */
export const SMS_MAX_CHARS = 385;

export interface SmsCount {
  encoding: "GSM-7" | "Unicode";
  /** Characters typed. */
  chars: number;
  /** Encoding units used (extended GSM characters take two; Unicode counts UTF-16 code units). */
  units: number;
  segments: number;
  /** Units left in the current segment before another one is needed. */
  remaining: number;
  perSegment: number;
  /** Characters that force Unicode, so the agent can see why a message got shorter. */
  specials: string[];
}

export function countSms(text: string): SmsCount {
  const chars = Array.from(text).length;
  let gsmUnits = 0;
  const specials: string[] = [];
  let gsm = true;
  for (const ch of text) {
    if (BASIC.has(ch)) gsmUnits += 1;
    else if (EXTENDED.has(ch)) gsmUnits += 2;
    else { gsm = false; if (!specials.includes(ch) && specials.length < 5) specials.push(ch); }
  }
  if (gsm) {
    const single = 160, multi = 153;
    const segments = gsmUnits === 0 ? 0 : gsmUnits <= single ? 1 : Math.ceil(gsmUnits / multi);
    const per = segments <= 1 ? single : multi;
    return { encoding: "GSM-7", chars, units: gsmUnits, segments, remaining: segments === 0 ? single : segments * per - gsmUnits, perSegment: per, specials: [] };
  }
  const units = text.length;
  const single = 70, multi = 67;
  const segments = units <= single ? 1 : Math.ceil(units / multi);
  const per = segments <= 1 ? single : multi;
  return { encoding: "Unicode", chars, units, segments, remaining: segments * per - units, perSegment: per, specials };
}

/** Why a message cannot be sent yet, or null when it can. Same limits as the server (1–385 characters after trimming). */
export function messageProblem(text: string): string | null {
  const t = text.trim();
  if (t.length === 0) return "Write the message";
  if (t.length > SMS_MAX_CHARS) return `The message is ${t.length - SMS_MAX_CHARS} characters too long (maximum ${SMS_MAX_CHARS})`;
  return null;
}
