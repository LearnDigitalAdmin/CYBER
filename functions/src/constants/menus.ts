/**
 * Menu Text Constants
 * All user-facing menu text in English and Swahili
 */

export const MENUS = {
  WELCOME: {
    en: 'Welcome to *SAMUHIA* — Property, Shop & Chama Manager 🏠\n\nPlease select your language:\n1. English\n2. Kiswahili',
    sw: 'Karibu *SAMUHIA* — Msimamizi wa Mali, Duka na Chama 🏠\n\nTafadhali chagua lugha:\n1. Kiingereza\n2. Kiswahili',
  },

  MAIN_MENU: {
    en: '*Main Menu*\n\n1. Pay Rent\n2. Get Rent Invoice\n3. Add Shop\n4. My Shop\n5. Pay Bill\n6. My Chama\n7. Manage My Plot\n8. Exit\n9. Help',
    sw: '*Menuu Kuu*\n\n1. Lipa Kodi\n2. Pata Ankara ya Kodi\n3. Ongeza Duka\n4. Duka Langu\n5. Lipa Bill\n6. Chama Changu\n7. Simamia Kipande Changu\n8. Toka\n9. Msaada',
  },

  MY_SHOP_MENU: {
    en: '*My Shop Menu*\n\n1. Quick Commands 🚀\n2. Today\'s Summary 📊\n3. View Stock 📦\n4. Weekly Report 📈\n5. Monthly Report 📉\n6. Setup Payment Account 💳\n7. Charge Customer 💰\n8. Help ❓\n9. Back to Main Menu',
    sw: '*Menyu ya Duka Langu*\n\n1. Amri za Haraka 🚀\n2. Muhtasari wa Leo 📊\n3. Angalia Hifadhi 📦\n4. Ripoti ya Wiki 📈\n5. Ripoti ya Mwezi 📉\n6. Msanidi Akaunti ya Kulipa 💳\n7. Kulipisha Mteja 💰\n8. Msaada ❓\n9. Rudi kwenye Menuu Kuu',
  },

  PAY_BILL_MENU: {
    en: '*Pay Bill*\n\n1. Pay My Bill\n2. Charge Customer\n3. Back to Main Menu',
    sw: '*Lipa Bill*\n\n1. Lipa Bill Yangu\n2. Chaji Mteja\n3. Rudi kwenye Menyu Kuu',
  },

  HELP_MENU: {
    en: '*Help & Support*\n\n📞 Phone: +254791286165\n📧 Email: info@samuhia.co.ke\n🌐 Web: www.samuhia.co.ke\n\nSupport Hours: 9 AM - 5 PM (Weekdays)\n\n*Reply 0 to return to Main Menu*',
    sw: '*Msaada & Kukuza*\n\n📞 Simu: +254791286165\n📧 Barua pepe: info@samuhia.co.ke\n🌐 Wavuti: www.samuhia.co.ke\n\nSaa za Msaada: 9 AM - 5 PM (Siku za Kazi)\n\n*Jibu 0 kurudi kwenye Menuu Kuu*',
  },

  BUSINESS_TYPES: {
    en: 'Select Business Type:\n\n1. Retail Shop\n2. Restaurant/Cafe\n3. Service Provider\n4. Salon/Spa/Kinyozi\n5. Electronics\n6. Clothing\n7. Groceries\n8. Other',
    sw: 'Chagua Aina ya Biashara:\n\n1. Duka la Retail\n2. Mgahawa/Kahawa\n3. Mtoa Huduma\n4. Saloni/Spa/Kinyozi\n5. Elektroniki\n6. Nguo\n7. Mboga\n8. Nyingine',
  },

  PAYMENT_METHODS: {
    en: 'Select Payment Method:\n\n1. Cash\n2. M-Pesa\n3. Bank Transfer\n4. Credit Card',
    sw: 'Chagua Njia ya Malipo:\n\n1. Pesa Taslimu\n2. M-Pesa\n3. Hundi ya Benki\n4. Kadi ya Mikopo',
  },

  EXPENSE_CATEGORIES: {
    en: 'Select Expense Category:\n\n1. Stock\n2. Rent\n3. Utilities\n4. Salaries\n5. Other',
    sw: 'Chagua Kategori ya Matumizi:\n\n1. Hisa\n2. Kodi\n3. Umeme/Maji\n4. Mshahara\n5. Nyingine',
  },
};

export function getMenu(key: keyof typeof MENUS, language: 'en' | 'sw'): string {
  return MENUS[key]?.[language] || `Menu not found: ${key}`;
}
