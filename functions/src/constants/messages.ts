/**
 * Message Templates
 * Common messages, prompts, and confirmations in both languages
 */

export const MESSAGES = {
  // Confirmations

  // Prompts
  ENTER_NATIONAL_ID: {
    en: 'Please enter your National ID (7-10 digits):',
    sw: 'Tafadhali ingiza Namba ya Kitambulisho cha Taifa (7-10 tarakamu):',
  },

  ENTER_TENANT_ID: {
    en: 'Enter the tenant ID to pay rent:',
    sw: 'Ingiza namba ya mkokoteni wa kodi:',
  },

  SEARCHING_TENANT: {
    en: 'Searching for tenant and invoice... Please wait ⏳',
    sw: 'Inatafuta mkokoteni na ankara... Tafadhali subiri ⏳',
  },

  TENANT_NOT_FOUND: {
    en: 'Tenant not found. Please check the ID and try again.',
    sw: 'Mkokoteni hajapatikana. Tafadhali angalia namba na ujaribu tena.',
  },

  INVOICE_NOT_FOUND: {
    en: 'No invoice or rent amount found for this tenant.',
    sw: 'Hakuna ankara au kiasi cha kodi kwa mkokoteni huyu.',
  },

  ENTER_MPESA_PHONE: {
    en: 'Enter your M-Pesa phone number (07XXXXXXXX):',
    sw: 'Ingiza namba ya simu ya M-Pesa (07XXXXXXXX):',
  },

  ENTER_PAYMENT_AMOUNT: {
    en: 'Enter the amount to pay (Max: {outstanding}):',
    sw: 'Ingiza kiasi cha kulipa (Max: {outstanding}):',
  },

  INVALID_AMOUNT_EXCEEDS: {
    en: 'Amount cannot exceed outstanding balance of {outstanding}',
    sw: 'Kiasi hakiwezi kuzidi {outstanding}',
  },

  ENTER_AMOUNT: {
    en: 'Enter the amount (in KES):',
    sw: 'Ingiza kiasi (kwa KES):',
  },

  ENTER_DESCRIPTION: {
    en: 'Enter description (optional):',
    sw: 'Ingiza maelezo (isimu):',
  },

  // Success messages

  // Error messages
  INVALID_ID: {
    en: 'Invalid National ID. Please enter a valid ID (7-10 digits):',
    sw: 'Namba ya kitambulisho si sahihi. Tafadhali ingiza namba sahihi (7-10 tarakamu):',
  },

  INVALID_PHONE: {
    en: 'Invalid phone number. Please enter a valid Kenyan number (07XXXXXXXX):',
    sw: 'Namba ya simu si sahihi. Tafadhali ingiza namba ya Kenya (07XXXXXXXX):',
  },

  INVALID_AMOUNT: {
    en: 'Invalid amount. Please enter a number between 10 and 1,000,000:',
    sw: 'Kiasi si sahihi. Tafadhali ingiza namba kati ya 10 na 1,000,000:',
  },

  PAYMENT_FAILED: {
    en: 'Payment failed. Please try again or contact support.',
    sw: 'Malipo yameshindwa. Tafadhali jaribu tena au wasiliana na msaada.',
  },

  PAYMENT_SUCCESS: {
    en: 'Payment successful! ✅\n\nTransaction ID: {transactionId}\nAmount: Ksh {amount}\nTime: {time}',
    sw: 'Malipo yamefanikiwa! ✅\n\nNamba ya Muamala: {transactionId}\nKiasi: Ksh {amount}\nWakati: {time}',
  },

  // Invalid input
  INVALID_INPUT: {
    en: 'Invalid input. Please try again.',
    sw: 'Ingizo si sahihi. Tafadhali jaribu tena.',
  },

  // Generic errors
  SYSTEM_ERROR: {
    en: 'An error occurred. Please try again later or contact support.',
    sw: 'Kulikuwa na hitilafu. Tafadhali jaribu baadaye au wasiliana na msaada.',
  },

  // Session timeout
  SESSION_EXPIRED: {
    en: 'Your session has expired. Please start over by sending any message.',
    sw: 'Kipindi chako kinatamatisha. Tafadhali anza upya kwa kutuma ujumbe wowote.',
  },

  // Navigation options
  NAVIGATION_HELP: {
    en: '\n\n*Navigation:*\n0️⃣ = Back\n00️⃣ = Start Over\n000️⃣ = Exit',
    sw: '\n\n*Usambazaji:*\n0️⃣ = Nyuma\n00️⃣ = Anza Upya\n000️⃣ = Toka',
  },

  // Thank you / goodbye
  GOODBYE: {
    en: 'Thank you for using SAMUHIA! See you soon. 👋',
    sw: 'Asante kwa kutumia SAMUHIA! Tutaonana karibuni. 👋',
  },
};

export function getMessage(key: keyof typeof MESSAGES, language: 'en' | 'sw', replacements?: Record<string, string>): string {
  let text = MESSAGES[key]?.[language] || `Message not found: ${key}`;

  if (replacements) {
    Object.entries(replacements).forEach(([key, value]) => {
      text = text.replace(`{${key}}`, value);
    });
  }

  return text;
}
