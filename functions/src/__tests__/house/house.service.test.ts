import '../ui/env';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../config/firebase.config';
import * as house from '../../services/house.service';
import * as sms from '../../services/house.sms';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── A tiny in-memory Firestore: just what house.service uses ──
let store: Map<string, any>;
const isInc = (v: any) => v?.constructor?.name === 'NumericIncrementTransform';
const isTs = (v: any) => v?.constructor?.name === 'ServerTimestampTransform';
const apply = (cur: any, patch: any) => {
  const next = { ...(cur ?? {}) };
  for (const [k, v] of Object.entries(patch)) next[k] = isInc(v) ? (Number(next[k]) || 0) + (v as any).operand : isTs(v) ? new Date(0) : v;
  return next;
};
let autoId = 0;
const ref = (path: string): any => {
  const segs = path.split('/');
  return {
    path,
    id: segs[segs.length - 1],
    parent: { id: segs[segs.length - 2], parent: segs.length > 2 ? ref(segs.slice(0, -2).join('/')) : null },
    get: async () => ({ exists: store.has(path), data: () => store.get(path), id: segs[segs.length - 1], ref: ref(path) }),
    update: async (p: any) => void store.set(path, apply(store.get(path), p)),
    set: async (p: any, o?: any) => void store.set(path, o?.merge ? apply(store.get(path), p) : apply({}, p)),
    collection: (name: string) => col(`${path}/${name}`),
  };
};
const col = (path: string): any => ({
  doc: (id: string) => ref(`${path}/${id}`),
  add: async (p: any) => void store.set(`${path}/auto${++autoId}`, apply({}, p)),
  where: (field: string, op: string, value: any) => ({
    get: async () => {
      const docs = [...store.entries()]
        .filter(([k]) => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1)
        .filter(([, v]) => (op === 'in' ? value.includes(v[field]) : v[field] === value))
        .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v, ref: ref(k) }));
      return { docs };
    },
  }),
});
const installDb = () => {
  (db as any).collection = (name: string) => col(name);
  (db as any).collectionGroup = (name: string) => ({
    where: (field: string, _op: string, value: any[]) => ({
      get: async () => ({
        docs: [...store.entries()]
          .filter(([k]) => /^users\/[^/]+\/properties\/[^/]+$/.test(k) && name === 'properties')
          .filter(([, v]) => value.includes(v[field]))
          .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v, ref: ref(k) })),
      }),
    }),
  });
  (db as any).runTransaction = async (fn: any) =>
    fn({
      get: (r: any) => r.get(),
      update: (r: any, p: any) => void store.set(r.path, apply(store.get(r.path), p)),
      set: (r: any, p: any, o?: any) => void store.set(r.path, o?.merge ? apply(store.get(r.path), p) : apply({}, p)),
    });
};

const seed = (tokens = 10) => {
  store = new Map();
  store.set('users/landlord1', { name: 'Wanjiru Kamau', phone: '0722000111', email: 'w@example.com', tokens, company: { name: 'Kamau Realtors' } });
  store.set('users/landlord1/properties/1', { ownerId: 'PYP-0001', name: 'Mirera Heights', address: 'Mirera, Naivasha' });
  store.set('users/landlord2', { name: 'Peter Otieno', phone: '0733000222', tokens: 100 });
  store.set('users/landlord2/properties/1', { ownerId: 'PYP-0002', name: 'Lake View', address: 'Milimani, Kisumu' });
  const pub = (ownerId: string, unitId: number, status: string, rent: number, unitNumber: string) =>
    store.set(`units/${ownerId}_${unitId}`, { ownerId, unitId, unitNumber, unitType: 'residential', unitSize: 'bedsitter', condition: 'new', status, rentAmount: rent, depositAmount: rent });
  pub('PYP-0001', 1001, 'vacant', 8000, 'BS-01');
  pub('PYP-0001', 1002, 'vacant', 6500, 'BS-02');
  pub('PYP-0001', 1003, 'occupied', 6000, 'BS-03');
  pub('PYP-0002', 1001, 'vacant', 9000, 'BS-01');
};

let smsLog: Array<{ to: string; text: string }>;
let smsOk: boolean;

beforeEach(() => {
  seed();
  installDb();
  house.clearHouseCaches();
  smsLog = [];
  smsOk = true;
  (sms as any).sendSmsMessage = async (to: string, text: string) => {
    smsLog.push({ to, text });
    return smsOk;
  };
});

const tokens = (uid = 'landlord1') => store.get(`users/${uid}`).tokens;
const found = async (area: string) => house.findVacantUnits(area);

describe('findVacantUnits', () => {
  test('returns only vacant units of properties whose address matches, cheapest first, with the manager account', async () => {
    const r = await found('mirer');
    assert.deepEqual(r.map((u) => u.unitNumber), ['BS-02', 'BS-01']);
    assert.equal(r[0].userId, 'landlord1');
    assert.equal(r[0].propertyName, 'Mirera Heights');
    assert.equal(r[0].address, 'Mirera, Naivasha');
  });
  test('misspelt either-word area finds the same property; another area finds the other', async () => {
    assert.equal((await found('navsha')).length, 2);
    assert.equal((await found('NAIVASA')).length, 2);
    assert.deepEqual((await found('kisumu')).map((u) => u.ownerId), ['PYP-0002']);
    assert.deepEqual(await found('eldoret'), []);
  });
  test('a unit that is no longer vacant is reported as gone', async () => {
    const [u] = await found('mirera');
    assert.equal(await house.isStillVacant(u), true);
    store.set('units/PYP-0001_1002', { ...store.get('units/PYP-0001_1002'), status: 'occupied' });
    assert.equal(await house.isStillVacant(u), u.unitId !== 1002);
  });
});

describe('getManager and canSendInquiry', () => {
  test('contact details are the stored ones, unmasked', async () => {
    const m = (await house.getManager('landlord1'))!;
    assert.deepEqual([m.name, m.company, m.email, m.smsPhone, m.tokens], ['Wanjiru Kamau', 'Kamau Realtors', 'w@example.com', '+254722000111', 10]);
    assert.equal(house.canSendInquiry(m), true);
  });
  test('no credits for the cheapest SMS, or no mobile number: not available', async () => {
    store.set('users/landlord1', { ...store.get('users/landlord1'), tokens: 1 });
    assert.equal(house.canSendInquiry(await house.getManager('landlord1')), false);
    store.set('users/landlord1', { ...store.get('users/landlord1'), tokens: 10, phone: '020123456' });
    assert.equal(house.canSendInquiry(await house.getManager('landlord1')), false);
  });
});

describe('sendInquiry', () => {
  const inquirer = '+254733444555';
  const unitOf = async () => (await found('mirera')).find((u) => u.unitNumber === 'BS-01')!;

  test('sends the SMS to the manager, charges 2 credits to the manager, and logs it', async () => {
    const r = await house.sendInquiry(await unitOf(), inquirer);
    assert.deepEqual(r, { ok: true, managerName: 'Wanjiru Kamau', credits: 2 });
    assert.deepEqual(smsLog, [{ to: '+254722000111', text: 'Dear Wanjiru, a tenant 0733444555 is inquiring on unit BS-01 on property Mirera Heights. Please contact them.' }]);
    assert.equal(tokens(), 8);
    const log = [...store.entries()].filter(([k]) => k.startsWith('users/landlord1/sms-sent-log/'));
    assert.equal(log.length, 1);
    assert.equal(log[0][1].tokensCharged, 2);
    const inq = [...store.entries()].filter(([k]) => k.startsWith('houseInquiries/'));
    assert.equal(inq.length, 1);
    assert.equal(inq[0][1].status, 'sent');
    assert.equal(inq[0][1].inquirerPhone, inquirer);
    assert.equal(store.get('users/landlord1').smsSentTotal, 1);
  });

  test('a longer message costs more: 4 credits for up to 275 characters', async () => {
    store.set('users/landlord1/properties/1', { ownerId: 'PYP-0001', name: 'P'.repeat(150), address: 'Mirera, Naivasha' });
    house.clearHouseCaches();
    const r = await house.sendInquiry(await unitOf(), inquirer);
    assert.deepEqual([r.ok, tokens()], [true, 6]);
  });

  test('provider refusal: credits and the daily allowance are put back, the attempt is logged as failed', async () => {
    smsOk = false;
    const u = await unitOf();
    assert.deepEqual(await house.sendInquiry(u, inquirer), { ok: false, reason: 'failed' });
    assert.equal(tokens(), 10);
    smsOk = true;
    assert.equal((await house.sendInquiry(u, inquirer)).ok, true);
    assert.equal(tokens(), 8);
    assert.deepEqual([...store.values()].filter((v) => v.status === 'failed').length, 1);
  });

  test('the same tenant cannot inquire twice on one unit in a day, nor more than 3 units', async () => {
    const [a, b] = await found('mirera');
    assert.equal((await house.sendInquiry(a, inquirer)).ok, true);
    assert.deepEqual(await house.sendInquiry(a, inquirer), { ok: false, reason: 'duplicate' });
    assert.equal((await house.sendInquiry(b, inquirer)).ok, true);
    store.set('units/PYP-0002_1001', store.get('units/PYP-0002_1001'));
    const c = (await found('kisumu'))[0];
    store.set('users/landlord2', { ...store.get('users/landlord2'), tokens: 100 });
    assert.equal((await house.sendInquiry(c, inquirer)).ok, true);
    const extra = { ...a, unitId: 1009, unitNumber: 'BS-09' };
    store.set('units/PYP-0001_1009', { ...store.get('units/PYP-0001_1001'), unitId: 1009 });
    assert.deepEqual(await house.sendInquiry(extra, inquirer), { ok: false, reason: 'limit' });
    assert.equal(smsLog.length, 3);
  });

  test('not enough credits: nothing is sent and nothing is charged', async () => {
    store.set('users/landlord1', { ...store.get('users/landlord1'), tokens: 1 });
    assert.deepEqual(await house.sendInquiry(await unitOf(), inquirer), { ok: false, reason: 'no_credits' });
    assert.equal(smsLog.length, 0);
    assert.equal(tokens(), 1);
  });

  test('a unit let in the meantime is refused as gone before anything is charged', async () => {
    const u = await unitOf();
    store.set('units/PYP-0001_1001', { ...store.get('units/PYP-0001_1001'), status: 'occupied' });
    assert.deepEqual(await house.sendInquiry(u, inquirer), { ok: false, reason: 'gone' });
    assert.equal(tokens(), 10);
  });
});
