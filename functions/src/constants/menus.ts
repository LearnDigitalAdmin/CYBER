/**
 * Menu Text Constants
 * All user-facing menu text in English and Swahili
 */

export const MENUS = {
  WELCOME: {
    en: 'Welcome to *SAMUHIA* — Property & Chama Manager 🏠\n\nPlease select your language:\n1. English\n2. Kiswahili',
    sw: 'Karibu *SAMUHIA* — Msimamizi wa Mali na Chama 🏠\n\nTafadhali chagua lugha:\n1. Kiingereza\n2. Kiswahili',
  },

  MAIN_MENU: {
    en: '*Main Menu*\n\n1. Pay Rent\n2. Get Rent Invoice\n3. My Chama\n4. Manage My Plot\n5. Exit\n6. Help',
    sw: '*Menuu Kuu*\n\n1. Lipa Kodi\n2. Pata Ankara ya Kodi\n3. My Chama\n4. Simamia Kipande Changu\n5. Toka\n6. Msaada',
  },

  HELP_MENU: {
    en: '*Help & Support*\n\n📞 Phone: +254791286165\n📧 Email: info@samuhia.co.ke\n🌐 Web: www.samuhia.co.ke\n\nSupport Hours: 9 AM - 5 PM (Weekdays)\n\n*Reply 0 to return to Main Menu*',
    sw: '*Msaada & Kukuza*\n\n📞 Simu: +254791286165\n📧 Barua pepe: info@samuhia.co.ke\n🌐 Wavuti: www.samuhia.co.ke\n\nSaa za Msaada: 9 AM - 5 PM (Siku za Kazi)\n\n*Jibu 0 kurudi kwenye Menuu Kuu*',
  },

};

export function getMenu(key: keyof typeof MENUS, language: 'en' | 'sw'): string {
  return MENUS[key]?.[language] || `Menu not found: ${key}`;
}
