/**
 * Message Templates
 * Common messages, prompts, and confirmations in both languages
 */

export const MESSAGES = {
  // Confirmations
  CONFIRM_PAY: {
    en: 'Reply *PAY* to confirm payment',
    sw: 'Jibu *LIPA* kubaini malipo',
  },

  // Prompts
  ENTER_NATIONAL_ID: {
    en: 'Please enter your National ID (7-10 digits):',
    sw: 'Tafadhali ingiza Namba ya Kitambulisho cha Taifa (7-10 tarakamu):',
  },

  ENTER_FULL_NAME: {
    en: 'What is your full name?',
    sw: 'Jina lako kamili ni nini?',
  },

  ENTER_SHOP_NAME: {
    en: 'What is your shop name?',
    sw: 'Jina la duka lako ni nini?',
  },

  ENTER_LOCATION: {
    en: 'What is your shop location/area (e.g., Westlands, Kilimani)?',
    sw: 'Mahali pa duka lako/eneo (mf. Westlands, Kilimani)?',
  },

  ENTER_EMPLOYEES: {
    en: 'How many employees do you have? (Enter a number):',
    sw: 'Una wafanyakazi wangapi? (Ingiza namba):',
  },

  ENTER_EMAIL: {
    en: 'Enter your email address (name@example.com):',
    sw: 'Ingiza barua pepe yako (jina@mfano.com):',
  },

  ENTER_PHONE: {
    en: 'Enter your phone number (07XXXXXXXX):',
    sw: 'Ingiza namba ya simu yako (07XXXXXXXX):',
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
  SHOP_CREATED_SUCCESS: {
    en: 'Success! Your shop has been created! 🎉\n\n*Shop Details:*\n📱 Owner: {ownerName}\n🏪 Shop: {shopName}\n📍 Location: {location}\n👥 Employees: {employees}\n🏭 Type: {businessType}\n📧 Email: {email}\n\n*Login Credentials:*\n📧 Email: {email}\n🔐 Password: {password}\n\nPlease save these credentials safely.',
    sw: 'Imefanikiwa! Duka lako limefungwa! 🎉\n\n*Maelezo ya Duka:*\n📱 Mwenye: {ownerName}\n🏪 Duka: {shopName}\n📍 Mahali: {location}\n👥 Wafanyakazi: {employees}\n🏭 Aina: {businessType}\n📧 Barua pepe: {email}\n\n*Jina la Duka la Kuingia:*\n📧 Barua pepe: {email}\n🔐 Neno la siri: {password}\n\nTafadhali hifadhi haya ya usalama.',
  },

  SHOP_CONFIRMATION: {
    en: '*Please confirm your shop details:*\n\n👤 Owner: {ownerName}\n🏪 Shop: {shopName}\n📍 Location: {location}\n👥 Employees: {employees}\n🏭 Type: {businessType}\n📱 Phone: {phone}\n📧 Email: {email}\n🆔 National ID: {nationalId}\n\nReply *YES* to confirm or *EDIT* to change',
    sw: '*Tafadhali baini maelezo ya duka:*\n\n👤 Mwenye: {ownerName}\n🏪 Duka: {shopName}\n📍 Mahali: {location}\n👥 Wafanyakazi: {employees}\n🏭 Aina: {businessType}\n📱 Simu: {phone}\n📧 Barua pepe: {email}\n🆔 Kitambulisho: {nationalId}\n\nJibu *NDIO* kubaini au *BAGUISHA* kubadilisha',
  },

  TRANSACTION_RECORDED: {
    en: 'Transaction recorded successfully! ✅\n\nAmount: Ksh {amount}\nType: {type}\nTime: {time}',
    sw: 'Muamala umerekodiwa kwa mafanikio! ✅\n\nKiasi: Ksh {amount}\nAina: {type}\nWakati: {time}',
  },

  // Error messages
  INVALID_ID: {
    en: 'Invalid National ID. Please enter a valid ID (7-10 digits):',
    sw: 'Namba ya kitambulisho si sahihi. Tafadhali ingiza namba sahihi (7-10 tarakamu):',
  },

  INVALID_PHONE: {
    en: 'Invalid phone number. Please enter a valid Kenyan number (07XXXXXXXX):',
    sw: 'Namba ya simu si sahihi. Tafadhali ingiza namba ya Kenya (07XXXXXXXX):',
  },

  INVALID_EMAIL: {
    en: 'Invalid email address. Please enter a valid email (name@example.com):',
    sw: 'Barua pepe si sahihi. Tafadhali ingiza barua pepe sahihi (jina@mfano.com):',
  },

  INVALID_EMPLOYEES: {
    en: 'Invalid number of employees. Please enter a number between 0 and 1000:',
    sw: 'Namba ya wafanyakazi si sahihi. Tafadhali ingiza namba kati ya 0 na 1000:',
  },

  INVALID_LOCATION: {
    en: 'Invalid location. Please enter a valid location (at least 2 characters):',
    sw: 'Mahali si sahihi. Tafadhali ingiza mahali sahihi (angalau herufi 2):',
  },

  INVALID_AMOUNT: {
    en: 'Invalid amount. Please enter a number between 10 and 1,000,000:',
    sw: 'Kiasi si sahihi. Tafadhali ingiza namba kati ya 10 na 1,000,000:',
  },

  SHOP_ALREADY_EXISTS: {
    en: 'A shop with this National ID already exists. Please use a different ID.',
    sw: 'Duka na hii namba ya kitambulisho tayari lipo. Tafadhali tumia kitambulisho tofauti.',
  },

  EMAIL_ALREADY_EXISTS: {
    en: 'This email is already registered. Please use a different email address.',
    sw: 'Barua pepe hii tayari imejiandikisha. Tafadhali tumia barua pepe tofauti.',
  },

  SHOP_NOT_FOUND: {
    en: 'Shop not found. Please check your National ID and try again:',
    sw: 'Duka halijapatikana. Tafadhali angalia namba yako na ujaribu tena:',
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
