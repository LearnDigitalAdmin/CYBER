/**
 * House to Rent: the inquiry SMS. Composing, pricing and the HostPinnacle call. No Firestore here.
 */
import axios from 'axios';
import { HP_SMS_APIKEY, HP_SMS_PASSWORD, HP_SMS_SENDERID, HP_SMS_USERID, SMS_API_URL } from '../config/sms.config';
import { logger } from '../utils/logger';

/** Longest SMS we ever send (the top price band). */
export const SMS_MAX_CHARS = 350;

/** Price bands, in SMS credits, by message length: up to 140 characters 2, up to 275 characters 4, up to 350 characters 7. */
export const SMS_PRICE_BANDS: ReadonlyArray<{ maxChars: number; credits: number }> = [
  { maxChars: 140, credits: 2 },
  { maxChars: 275, credits: 4 },
  { maxChars: 350, credits: 7 },
];

/** The cheapest inquiry there is: below this balance the Send Inquiry option is not offered. */
export const MIN_INQUIRY_CREDITS = SMS_PRICE_BANDS[0].credits;

/** Credits for a message of this length, or null when it is longer than the maximum. */
export function smsCredits(length: number): number | null {
  for (const band of SMS_PRICE_BANDS) if (length <= band.maxChars) return band.credits;
  return null;
}

/** Plain GSM-friendly text: no emoji, printable Latin-1 only, single spaces. */
export function cleanSmsText(text: string): string {
  return (text ?? '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Wanjiru Kamau" -> "Wanjiru": the greeting is cut at the first space. */
export function firstName(full: string | undefined | null): string {
  const first = cleanSmsText(full || '').split(' ')[0];
  return first || 'Sir/Madam';
}

export interface InquirySmsInput {
  managerName: string | undefined | null;
  /** The inquiring person's number as the manager should dial it, e.g. 0712345678 */
  inquirerPhone: string;
  unitNumber: string;
  propertyName: string;
}

/**
 * "Dear Wanjiru, a tenant 0712345678 is inquiring on unit BS-01 on property Mirera Heights. Please contact them."
 * Always within SMS_MAX_CHARS: an over-long property name is shortened, never the rest of the message.
 */
export function composeInquirySms(i: InquirySmsInput): string {
  const build = (property: string): string =>
    cleanSmsText(`Dear ${firstName(i.managerName)}, a tenant ${i.inquirerPhone} is inquiring on unit ${cleanSmsText(i.unitNumber)} on property ${property}. Please contact them.`);
  let property = cleanSmsText(i.propertyName);
  let sms = build(property);
  while (sms.length > SMS_MAX_CHARS && property.length > 4) {
    property = property.slice(0, Math.max(4, property.length - (sms.length - SMS_MAX_CHARS) - 1)).trimEnd();
    sms = build(property);
  }
  return sms;
}

/** Send one SMS. Never throws; returns whether the provider accepted it. */
export async function sendSmsMessage(msisdn: string, message: string): Promise<boolean> {
  try {
    const userid = HP_SMS_USERID.value();
    const apikey = HP_SMS_APIKEY.value();
    if (!userid || !apikey) {
      logger.warn('House to Rent: SMS credentials are not configured');
      return false;
    }
    const form = new URLSearchParams({
      userid,
      password: HP_SMS_PASSWORD.value(),
      apikey,
      senderid: HP_SMS_SENDERID.value(),
      mobile: msisdn.replace(/\D/g, ''),
      msg: message,
      sendMethod: 'quick',
      msgType: 'text',
      output: 'json',
      duplicatecheck: 'true',
    });
    // HostPinnacle expects form-encoded fields; a JSON body is not parsed
    const res = await axios.post(SMS_API_URL, form.toString(), {
      timeout: 15000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: (s) => s >= 200 && s < 300,
    });
    const status = String((res.data as { status?: unknown } | undefined)?.status ?? '').toLowerCase();
    const failed = status === 'error' || status === 'fail' || status === 'failed' || status === 'failure' || (res.data as { ErrorCode?: unknown } | undefined)?.ErrorCode !== undefined;
    if (failed) logger.warn('House to Rent: SMS provider rejected the message');
    return !failed;
  } catch (error) {
    logger.warn('House to Rent: SMS send failed', { reason: axios.isAxiosError(error) ? error.code || error.message : 'unknown' });
    return false;
  }
}
