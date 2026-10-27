import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Rig } from '../ui/rig';
import { STATE } from '../../constants/states';
import { HOUSE_LABELS, HOUSE_MESSAGES } from '../../constants/house.messages';
import { areaTokens, bestMatches, wordMatches } from '../../utils/house.match';
import { composeInquirySms, firstName, MIN_INQUIRY_CREDITS, smsCredits } from '../../services/house.sms';
import * as house from '../../services/house.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('area matching', () => {
  const props = [
    { id: 'a', address: 'Mirera, Naivasha' },
    { id: 'b', address: 'Kilimani, Nairobi' },
    { id: 'c', address: 'Section 58, Nakuru' },
    { id: 'd', address: 'Naivasha Town' },
  ];
  const ids = (q: string) => bestMatches(q, props, (p) => p.address).map((p) => p.id).sort();

  test('either word of the address finds it, in any case', () => {
    for (const q of ['mirera', 'MIRERA', 'Naivasha', 'naivasha']) assert.ok(ids(q).includes('a'), q);
  });
  test('misspellings still match', () => {
    for (const q of ['mirer', 'miera', 'navsha', 'naivasa', 'naivash', 'nayvasha', 'Naivassha']) assert.ok(ids(q).includes('a'), q);
  });
  test('two words prefer the property that matches both', () => {
    assert.deepEqual(ids('mirera naivasha'), ['a']);
    assert.deepEqual(ids('naivasha'), ['a', 'd']);
  });
  test('unrelated areas do not match', () => {
    assert.deepEqual(ids('kitengela'), []);
    assert.deepEqual(ids('nairobi'), ['b']);
    assert.ok(!wordMatches('rongai', 'ongata'));
    assert.ok(!wordMatches('nakuru', 'naivasha'));
  });
  test('words that say nothing about where are ignored', () => {
    assert.deepEqual(areaTokens('Near Mirera Road, Naivasha'), ['mirera', 'naivasha']);
    assert.deepEqual(areaTokens('12'), []);
  });
});

describe('inquiry SMS', () => {
  test('price bands: 140 -> 2, 275 -> 4, 350 -> 7, longer is refused', () => {
    assert.equal(smsCredits(1), 2);
    assert.equal(smsCredits(140), 2);
    assert.equal(smsCredits(141), 4);
    assert.equal(smsCredits(275), 4);
    assert.equal(smsCredits(276), 7);
    assert.equal(smsCredits(350), 7);
    assert.equal(smsCredits(351), null);
    assert.equal(MIN_INQUIRY_CREDITS, 2);
  });
  test('greeting is cut at the first space', () => {
    assert.equal(firstName('Wanjiru Kamau'), 'Wanjiru');
    assert.equal(firstName('  '), 'Sir/Madam');
    const sms = composeInquirySms({ managerName: 'Wanjiru Kamau', inquirerPhone: '0712345678', unitNumber: 'BS-01', propertyName: 'Mirera Heights' });
    assert.equal(sms, 'Dear Wanjiru, a tenant 0712345678 is inquiring on unit BS-01 on property Mirera Heights. Please contact them.');
    assert.equal(smsCredits(sms.length), 2);
  });
  test('a very long property name is shortened so the SMS never exceeds 350 characters', () => {
    const sms = composeInquirySms({ managerName: 'Wanjiru', inquirerPhone: '0712345678', unitNumber: 'BS-01', propertyName: 'X'.repeat(900) });
    assert.ok(sms.length <= 350);
    assert.ok(sms.endsWith('Please contact them.'));
  });
  test('emoji and non-Latin characters are stripped', () => {
    const sms = composeInquirySms({ managerName: 'Wanjiru', inquirerPhone: '0712345678', unitNumber: 'BS-01', propertyName: 'Villa 🏠 Ω' });
    assert.ok(/^[\x20-\x7E\xA0-\xFF]+$/.test(sms));
  });
});

describe('copy', () => {
  test('every label fits a WhatsApp button (20) in both languages', () => {
    for (const [k, v] of Object.entries(HOUSE_LABELS)) for (const lang of ['en', 'sw'] as const) assert.ok(v[lang].replace('{phone}', '0712345678').length <= 20, `${k}/${lang}`);
  });
  test('every message exists in both languages and the placeholders agree', () => {
    for (const [k, v] of Object.entries(HOUSE_MESSAGES)) {
      assert.ok(v.en && v.sw, k);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      assert.equal(ph(v.en), ph(v.sw), k);
    }
  });
});

// ── Conversation flows (house.service is replaced; everything else is the real webhook and handlers) ──

const unit = (over: Partial<house.VacantUnit> = {}): house.VacantUnit => ({
  ownerId: 'PYP-0001',
  unitId: 1001,
  userId: 'landlord1',
  propertyId: 1,
  unitNumber: 'BS-01',
  unitType: 'residential',
  unitSize: 'bedsitter',
  condition: 'maintained',
  rentAmount: 6500,
  depositAmount: 6500,
  propertyName: 'Mirera Heights',
  address: 'Mirera, Naivasha',
  ...over,
});

const manager = (over: Partial<house.Manager> = {}): house.Manager => ({
  userId: 'landlord1',
  name: 'Wanjiru Kamau',
  firstName: 'Wanjiru',
  company: 'Kamau Realtors',
  phone: '0722000111',
  email: 'wanjiru@example.com',
  smsPhone: '+254722000111',
  tokens: 50,
  ...over,
});

let units: house.VacantUnit[];
let mgr: house.Manager | null;
let sent: Array<{ unit: house.VacantUnit; inquirer: string }>;
let sendResult: house.InquiryResult;
let stillVacant: boolean;

beforeEach(() => {
  units = [unit(), unit({ unitId: 1002, unitNumber: '1B-01', unitSize: 'one_bedroom', rentAmount: 12000 })];
  mgr = manager();
  sent = [];
  stillVacant = true;
  sendResult = { ok: true, managerName: 'Wanjiru Kamau', credits: 2 };
  const h = house as any;
  h.findVacantUnits = async (area: string) => (/nav|naiv|mir/i.test(area) ? units : []);
  h.isStillVacant = async () => stillVacant;
  h.getManager = async () => mgr;
  h.previewInquiry = async (u: house.VacantUnit, inq: string) =>
    stillVacant
      ? { ok: true, sms: composeInquirySms({ managerName: mgr?.name, inquirerPhone: house.toLocalPhone(inq), unitNumber: u.unitNumber, propertyName: u.propertyName }), managerName: mgr?.name ?? '', credits: 2 }
      : { ok: false, reason: 'gone' };
  h.sendInquiry = async (u: house.VacantUnit, inq: string) => {
    sent.push({ unit: u, inquirer: inq });
    return sendResult;
  };
});

const fresh = (lang: 'en' | 'sw' = 'en') => new Rig({ lang, state: STATE.MAIN_MENU });

describe('House to Rent flow', () => {
  test('main menu option 8 asks for the area, in both languages', async () => {
    for (const [lang, title] of [['en', 'House to Rent'], ['sw', 'Nyumba ya Kupanga']] as const) {
      const r = fresh(lang);
      await r.say('8');
      assert.equal(r.state, STATE.HTR_AREA);
      assert.match(r.body(), lang === 'en' ? /Type the \*area\*/ : /Andika \*eneo\*/);
      assert.ok(r.body().includes(title));
    }
  });

  test('an area with no vacant units says so and stays ready for another area', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('Kitengela');
    assert.equal(r.state, STATE.HTR_AREA);
    assert.match(r.body(), /no listed vacant units in \*Kitengela\*/);
    await r.say('mirer');
    assert.equal(r.state, STATE.HTR_RESULTS);
  });

  test('Kiswahili: nothing found', async () => {
    const r = fresh('sw');
    await r.say('8');
    await r.say('Kitengela');
    assert.match(r.body(), /Hakuna nyumba au vyumba vilivyo wazi/);
  });

  test('a one-character answer is not an area', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('7');
    assert.equal(r.state, STATE.HTR_AREA);
    assert.match(r.body(), /at least 3 letters/);
  });

  test('results list the units; picking one shows the details with Send Inquiry and Contact Manager', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('navsha');
    assert.equal(r.state, STATE.HTR_RESULTS);
    assert.deepEqual(r.titles(), ['Bedsitter', 'One bedroom', 'Back']);
    await r.say('1');
    assert.equal(r.state, STATE.HTR_UNIT);
    assert.match(r.body(), /Mirera Heights/);
    assert.match(r.body(), /KES 6,500/);
    assert.deepEqual(r.titles(), ['Send Inquiry', 'Contact Manager', 'Back']);
  });

  test('Contact Manager shows name and details unmasked', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('mirera');
    await r.say('1');
    await r.tap('Contact Manager');
    assert.equal(r.state, STATE.HTR_CONTACT);
    for (const s of ['Wanjiru Kamau', 'Kamau Realtors', '0722000111', 'wanjiru@example.com']) assert.ok(r.body().includes(s), s);
    assert.deepEqual(r.titles(), ['Send Inquiry', 'Back', 'Main menu']);
  });

  test('no SMS (no credits or no number): Send Inquiry is not offered', async () => {
    for (const m of [manager({ tokens: 1 }), manager({ smsPhone: null })]) {
      mgr = m;
      const r = fresh();
      await r.say('8');
      await r.say('mirera');
      await r.say('1');
      assert.deepEqual(r.titles(), ['Contact Manager', 'Back', 'Main menu']);
    }
  });

  test('Send Inquiry: number, preview of the exact SMS, send, and no second inquiry is offered', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('mirera');
    await r.say('1');
    await r.tap('Send Inquiry');
    assert.equal(r.state, STATE.HTR_INQ_PHONE);
    assert.deepEqual(r.titles(), ['Use 0712345678', 'Back', 'Main menu']);

    await r.say('abc');
    assert.equal(r.state, STATE.HTR_INQ_PHONE);
    assert.match(r.body(), /not a valid Kenyan phone number/);

    await r.say('0733 444 555');
    assert.equal(r.state, STATE.HTR_INQ_CONFIRM);
    assert.match(r.body(), /Dear Wanjiru, a tenant 0733444555 is inquiring on unit BS-01 on property Mirera Heights\. Please contact them\./);

    await r.tap('Send now');
    assert.equal(r.state, STATE.HTR_UNIT);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].inquirer, '+254733444555');
    assert.match(r.body(), /inquiry has been sent to \*Wanjiru Kamau\*/);
    assert.deepEqual(r.titles(), ['Contact Manager', 'Back', 'Main menu']);
  });

  test('the WhatsApp number can be used with one tap', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('mirera');
    await r.say('1');
    await r.say('1');
    await r.tap('Use 0712345678');
    assert.equal(r.state, STATE.HTR_INQ_CONFIRM);
    assert.match(r.body(), /a tenant 0712345678 is inquiring/);
  });

  test('Kiswahili inquiry flow', async () => {
    const r = fresh('sw');
    await r.say('8');
    await r.say('mirera');
    await r.say('1');
    assert.deepEqual(r.titles(), ['Tuma Maulizo', 'Wasiliana na Meneja', 'Nyuma']);
    await r.say('1');
    assert.match(r.body(), /Meneja anahitaji namba/);
    await r.say('0733444555');
    assert.match(r.body(), /Tutatuma SMS hii kwa \*Wanjiru Kamau\*/);
    await r.tap('Tuma sasa');
    assert.match(r.body(), /Maulizo yako yametumwa/);
  });

  test('refusals are explained and leave the tenant on the unit', async () => {
    const cases: Array<[house.InquiryResult, RegExp]> = [
      [{ ok: false, reason: 'limit' }, /today's limit of 3 inquiries/],
      [{ ok: false, reason: 'duplicate' }, /already sent an inquiry for this unit/],
      [{ ok: false, reason: 'failed' }, /could not send the SMS/],
      [{ ok: false, reason: 'no_credits' }, /not available for this property/],
    ];
    for (const [result, pattern] of cases) {
      sendResult = result;
      const r = fresh();
      await r.say('8');
      await r.say('mirera');
      await r.say('1');
      await r.say('1');
      await r.say('0733444555');
      await r.say('1');
      assert.equal(r.state, STATE.HTR_UNIT);
      assert.match(r.body(), pattern);
    }
  });

  test('a unit let in the meantime is dropped from the list with a notice', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('mirera');
    stillVacant = false;
    await r.say('1');
    assert.equal(r.state, STATE.HTR_RESULTS);
    assert.match(r.body(), /no longer listed as vacant/);
    assert.deepEqual(r.titles(), ['One bedroom', 'Back']);
  });

  test('0 steps back one screen at a time, # goes to the main menu, 000 to the language screen', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('mirera');
    await r.say('1');
    await r.say('1');
    await r.say('0733444555');
    assert.equal(r.state, STATE.HTR_INQ_CONFIRM);
    await r.say('0');
    assert.equal(r.state, STATE.HTR_INQ_PHONE);
    await r.say('0');
    assert.equal(r.state, STATE.HTR_UNIT);
    await r.say('0');
    assert.equal(r.state, STATE.HTR_RESULTS);
    await r.say('0');
    assert.equal(r.state, STATE.HTR_AREA);
    await r.say('0');
    assert.equal(r.state, STATE.MAIN_MENU);

    await r.say('8');
    await r.say('mirera');
    await r.say('#');
    assert.equal(r.state, STATE.MAIN_MENU);
    await r.say('8');
    await r.say('000');
    assert.equal(r.state, STATE.LANGUAGE_SELECTION);
  });

  test('a button from an old screen is ignored', async () => {
    const r = fresh();
    await r.say('8');
    await r.say('mirera');
    await r.tapId('ui:HTR_AREA:1');
    assert.equal(r.state, STATE.HTR_RESULTS);
    assert.match(r.body(), /no longer active/);
  });
});
