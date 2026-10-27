/**
 * HostPinnacle SMS credentials. These are the project's EXISTING secrets (the same set PMS, PAY and Desk bind):
 * CYBER, PAY and PMS share one project, so nothing new is created. Bind `HP_SECRETS` on any function that sends.
 */
import { defineSecret } from 'firebase-functions/params';

export const HP_SMS_USERID = defineSecret('HP_SMS_USERID');
export const HP_SMS_PASSWORD = defineSecret('HP_SMS_PASSWORD');
export const HP_SMS_APIKEY = defineSecret('HP_SMS_APIKEY');
export const HP_SMS_SENDERID = defineSecret('HP_SMS_SENDERID');

export const HP_SECRETS = [HP_SMS_USERID, HP_SMS_PASSWORD, HP_SMS_APIKEY, HP_SMS_SENDERID];

export const SMS_API_URL = 'https://smsportal.hostpinnacle.co.ke/SMSApi/send';
