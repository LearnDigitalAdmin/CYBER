/**
 * House to Rent: copy, English + Kiswahili.
 * Labels stay within 20 characters so they are valid as reply buttons (enforced by __tests__/house/house.test.ts).
 */
import { Lang } from '../types/watch.types';
import { fill } from '../utils/watch.format';

type Bi = { en: string; sw: string };

export const HOUSE_LABELS = {
  SEND_INQUIRY: { en: 'Send Inquiry', sw: 'Tuma Maulizo' },
  CONTACT_MANAGER: { en: 'Contact Manager', sw: 'Wasiliana na Meneja' },
  SEND_NOW: { en: 'Send now', sw: 'Tuma sasa' },
  USE_NUMBER: { en: 'Use {phone}', sw: 'Tumia {phone}' },
} satisfies Record<string, Bi>;

export type HouseLabelKey = keyof typeof HOUSE_LABELS;

export function hlabel(key: HouseLabelKey, lang: Lang, params?: Record<string, string | number>): string {
  return fill(HOUSE_LABELS[key][lang], params);
}

export const HOUSE_MESSAGES = {
  ASK_AREA: {
    en: '🏠 *House to Rent*\n\nType the *area* where you want to live, for example _Mirera_ or _Naivasha_.\n\nSend *0* to go back or *#* for the main menu.',
    sw: '🏠 *Nyumba ya Kupanga*\n\nAndika *eneo* unalotaka kuishi, kwa mfano _Mirera_ au _Naivasha_.\n\nTuma *0* kurudi nyuma au *#* kwenda menyu kuu.',
  },
  BAD_AREA: {
    en: 'Please type the name of an area with at least 3 letters, for example _Naivasha_.',
    sw: 'Tafadhali andika jina la eneo lenye angalau herufi 3, kwa mfano _Naivasha_.',
  },
  NONE: {
    en: 'There are no listed vacant units in *{area}* right now.\n\nType another area to search again.',
    sw: 'Hakuna nyumba au vyumba vilivyo wazi vilivyoorodheshwa katika *{area}* kwa sasa.\n\nAndika eneo jingine ili kutafuta tena.',
  },
  RESULTS: {
    en: '🏠 *{count}* for "{area}"\n\nChoose one to see the details, or type another area to search again.',
    sw: '🏠 *{count}* kwa "{area}"\n\nChagua moja uone maelezo, au andika eneo jingine kutafuta tena.',
  },
  COUNT_ONE: { en: '1 vacant unit', sw: 'Nyumba 1 iliyo wazi' },
  COUNT_MANY: { en: '{n} vacant units', sw: 'Nyumba {n} zilizo wazi' },
  UNIT: {
    en: '🏠 *{size}* ({unit})\n\n🏢 Property: *{property}*\n📍 Address: {address}\n🏷️ Type: {type}\n✨ Condition: {condition}\n💰 Rent: *{rent}* per month\n🔐 Deposit: {deposit}\n\nWhat would you like to do?',
    sw: '🏠 *{size}* ({unit})\n\n🏢 Mali: *{property}*\n📍 Anwani: {address}\n🏷️ Aina: {type}\n✨ Hali: {condition}\n💰 Kodi: *{rent}* kwa mwezi\n🔐 Amana: {deposit}\n\nUngependa kufanya nini?',
  },
  NO_DEPOSIT: { en: 'none listed', sw: 'haijaorodheshwa' },
  NO_ADDRESS: { en: 'not listed', sw: 'haijaorodheshwa' },
  CONTACT: {
    en: '📞 *Property management*\n\n{lines}\n\nFor: {size} ({unit}) at {property}',
    sw: '📞 *Usimamizi wa mali*\n\n{lines}\n\nKuhusu: {size} ({unit}) katika {property}',
  },
  CONTACT_NAME: { en: 'Manager: *{v}*', sw: 'Meneja: *{v}*' },
  CONTACT_COMPANY: { en: 'Company: {v}', sw: 'Kampuni: {v}' },
  CONTACT_PHONE: { en: 'Phone: {v}', sw: 'Simu: {v}' },
  CONTACT_EMAIL: { en: 'Email: {v}', sw: 'Barua pepe: {v}' },
  ASK_PHONE: {
    en: 'The manager needs a number to reach you on.\n\nType your phone number (for example 0712345678), or tap the button to use this WhatsApp number.',
    sw: 'Meneja anahitaji namba ya kukupigia.\n\nAndika namba yako ya simu (kwa mfano 0712345678), au gusa kitufe kutumia namba hii ya WhatsApp.',
  },
  BAD_PHONE: {
    en: 'That is not a valid Kenyan phone number. Please type it like 0712345678.',
    sw: 'Hiyo si namba sahihi ya simu ya Kenya. Tafadhali iandike hivi: 0712345678.',
  },
  CONFIRM: {
    en: 'Please confirm. We will send this SMS to *{name}*:\n\n_{sms}_\n\nSend the inquiry?',
    sw: 'Tafadhali thibitisha. Tutatuma SMS hii kwa *{name}*:\n\n_{sms}_\n\nTuma maulizo?',
  },
  SENT: {
    en: '✅ Your inquiry has been sent to *{name}*. They will contact you on {phone}.',
    sw: '✅ Maulizo yako yametumwa kwa *{name}*. Atawasiliana nawe kupitia {phone}.',
  },
  SEND_FAILED: {
    en: 'We could not send the SMS. Please try again in a moment, or use *Contact Manager*.',
    sw: 'Hatukuweza kutuma SMS. Tafadhali jaribu tena baada ya muda mfupi, au tumia *Wasiliana na Meneja*.',
  },
  SMS_UNAVAILABLE: {
    en: 'Inquiries by SMS are not available for this property right now. Please use *Contact Manager*.',
    sw: 'Kutuma maulizo kwa SMS hakupatikani kwa mali hii kwa sasa. Tafadhali tumia *Wasiliana na Meneja*.',
  },
  LIMIT: {
    en: 'You have reached today\'s limit of {max} inquiries. Please try again tomorrow, or use *Contact Manager*.',
    sw: 'Umefikia kikomo cha maulizo {max} ya leo. Tafadhali jaribu kesho, au tumia *Wasiliana na Meneja*.',
  },
  DUPLICATE: {
    en: 'You already sent an inquiry for this unit today. The manager has your number.',
    sw: 'Tayari ulituma maulizo kuhusu nyumba hii leo. Meneja ana namba yako.',
  },
  GONE: {
    en: 'Sorry, that unit is no longer listed as vacant.',
    sw: 'Samahani, nyumba hiyo haijaorodheshwa tena kama iliyo wazi.',
  },
} satisfies Record<string, Bi>;

export type HouseMsgKey = keyof typeof HOUSE_MESSAGES;

export function hmsg(key: HouseMsgKey, lang: Lang, params?: Record<string, string | number>): string {
  // split/join keeps `$&` and friends inside names or SMS text literal
  let text: string = HOUSE_MESSAGES[key][lang];
  for (const [k, v] of Object.entries(params ?? {})) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/** Unit vocabulary as the public listing stores it (see Units.ts in the app). */
export const UNIT_SIZE_LABELS: Record<string, Bi> = {
  single_room: { en: 'Single room', sw: 'Chumba kimoja' },
  bedsitter: { en: 'Bedsitter', sw: 'Bedsitter' },
  studio: { en: 'Studio', sw: 'Studio' },
  one_bedroom: { en: 'One bedroom', sw: 'Chumba 1 cha kulala' },
  two_bedroom: { en: 'Two bedroom', sw: 'Vyumba 2 vya kulala' },
  three_bedroom: { en: 'Three bedroom', sw: 'Vyumba 3 vya kulala' },
  maisonette: { en: 'Maisonette', sw: 'Maisonette' },
  shop: { en: 'Shop', sw: 'Duka' },
  office: { en: 'Office', sw: 'Ofisi' },
  stall: { en: 'Stall', sw: 'Kibanda' },
  warehouse: { en: 'Warehouse', sw: 'Ghala' },
  other: { en: 'Unit', sw: 'Nyumba' },
};

export const UNIT_TYPE_LABELS: Record<string, Bi> = {
  residential: { en: 'Residential', sw: 'Makazi' },
  commercial: { en: 'Commercial', sw: 'Biashara' },
};

export const UNIT_CONDITION_LABELS: Record<string, Bi> = {
  new: { en: 'New', sw: 'Mpya' },
  maintained: { en: 'Well maintained', sw: 'Inatunzwa vizuri' },
  old: { en: 'Old', sw: 'Ya zamani' },
};

export const unitSizeText = (v: string, lang: Lang): string => (UNIT_SIZE_LABELS[v] ?? UNIT_SIZE_LABELS.other)[lang];
export const unitTypeText = (v: string, lang: Lang): string => (UNIT_TYPE_LABELS[v] ?? UNIT_TYPE_LABELS.residential)[lang];
export const unitConditionText = (v: string, lang: Lang): string => (UNIT_CONDITION_LABELS[v] ?? UNIT_CONDITION_LABELS.maintained)[lang];
