import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkText, dateLong, dateShort, dateTimeNairobi, fill, insideServiceWindow, isSafaricomE164, isWatchKeyword, kes, monthLabel,
  nairobiToday, normalizeKenyanPhone, normalizeOwnerId, paginate, parseNavCommand, parseOtp, parseYesNo, plain, toE164, truncate,
} from '../../utils/watch.format';
import { dedupDecision } from '../../utils/dedup';

describe('owner id validation and normalisation', () => {
  const good: [string, string][] = [
    ['PYP-0001', 'PYP-0001'], ['pyp-0001', 'PYP-0001'], ['  PYP 0001 ', 'PYP-0001'], ['PYP0001', 'PYP-0001'],
    ['PYP–0001', 'PYP-0001'], ['pyp - 9999', 'PYP-9999'], ['PYP-10000', 'PYP-10000'], ['PYP−123456', 'PYP-123456'],
  ];
  for (const [i, o] of good) test(`accepts ${JSON.stringify(i)}`, () => assert.equal(normalizeOwnerId(i), o));
  for (const bad of ['', 'PYP-1', 'PYP-123', '0001', '12345678', 'ABC-0001', 'PYP-00A1', 'PYP-', 'hello', 'PYP-0001 and more', 'PYP-1234567890123'])
    test(`rejects ${JSON.stringify(bad)}`, () => assert.equal(normalizeOwnerId(bad), null));
});

describe('phones', () => {
  test('WhatsApp id to E.164', () => assert.equal(toE164('254712345678'), '+254712345678'));
  for (const [i, o] of [['0712345678', '+254712345678'], ['0112345678', '+254112345678'], ['+254712345678', '+254712345678'],
    ['254712345678', '+254712345678'], ['0712 345 678', '+254712345678'], ['712345678', '+254712345678'], ['07-12-345-678', '+254712345678']])
    test(`normalises ${i}`, () => assert.equal(normalizeKenyanPhone(i), o));
  for (const bad of ['', '0212345678', '071234567', '07123456789', '+255712345678', 'abc', '0812345678'])
    test(`rejects ${JSON.stringify(bad)}`, () => assert.equal(normalizeKenyanPhone(bad), null));
  test('safaricom check', () => {
    assert.ok(isSafaricomE164('+254712345678'));
    assert.ok(!isSafaricomE164('+255712345678'));
  });
});

describe('pagination', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);
  test('first / middle / last page', () => {
    const a = paginate(items, 0, 8);
    assert.deepEqual([a.items.length, a.pages, a.hasPrev, a.hasNext], [8, 4, false, true]);
    const b = paginate(items, 2, 8);
    assert.deepEqual([b.items[0], b.hasPrev, b.hasNext], [17, true, true]);
    const c = paginate(items, 3, 8);
    assert.deepEqual([c.items, c.hasNext], [[25], false]);
  });
  test('out-of-range and junk pages are clamped; empty list has one page', () => {
    assert.equal(paginate(items, 99, 8).page, 3);
    assert.equal(paginate(items, -4, 8).page, 0);
    assert.equal(paginate(items, NaN, 8).page, 0);
    const e = paginate([], 0, 8);
    assert.deepEqual([e.items.length, e.pages, e.hasNext], [0, 1, false]);
  });
  test('25 properties at 6 per page covers everything exactly once', () => {
    const seen: number[] = [];
    for (let p = 0; p < paginate(items, 0, 6).pages; p++) seen.push(...paginate(items, p, 6).items);
    assert.deepEqual(seen, items);
  });
});

describe('text helpers', () => {
  test('plain strips WhatsApp formatting and control chars', () => {
    assert.equal(plain('*Bold* _it_ ~s~ `c`\nline'), 'Bold it s c line');
    assert.equal(plain(null), '');
    assert.equal(plain('x'.repeat(100), 10).length, 10);
  });
  test('truncate / chunkText / fill', () => {
    assert.equal(truncate('abcdef', 4), 'abc…');
    const text = Array.from({ length: 200 }, (_, i) => `line ${i} `.padEnd(40, 'x')).join('\n');
    const chunks = chunkText(text, 1000);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((c) => c.length <= 1000));
    assert.equal(chunks.join('\n'), text);
    assert.equal(fill('a {x} {y}', { x: 1 }), 'a 1 {y}');
  });
  test('kes formats the quota price only', () => {
    assert.equal(kes(99), 'KES 99');
    assert.equal(kes(12500), 'KES 12,500');
    assert.equal(kes(1250.5), 'KES 1,250.5');
  });
});

describe('dates and months (Swahili in Swahili mode)', () => {
  test('month label', () => {
    assert.equal(monthLabel('2026-10', 'en'), 'October 2026');
    assert.equal(monthLabel('2026-10', 'sw'), 'Oktoba 2026');
    assert.equal(monthLabel('2026-03', 'sw'), 'Machi 2026');
    assert.equal(monthLabel('garbage', 'sw'), 'garbage');
  });
  test('all 12 Swahili months', () => {
    const names = Array.from({ length: 12 }, (_, i) => monthLabel(`2026-${String(i + 1).padStart(2, '0')}`, 'sw').split(' ')[0]);
    assert.deepEqual(names, ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba']);
  });
  test('long and short dates', () => {
    assert.equal(dateLong('2026-10-10', 'sw'), '10 Oktoba 2026');
    assert.equal(dateLong('2026-10-15', 'en'), '15 October 2026');
    assert.equal(dateShort('2026-10-04', 'sw'), '4 Okt');
    assert.equal(dateLong(null, 'en'), '');
  });
  test('Nairobi time conversions', () => {
    assert.equal(nairobiToday(Date.parse('2026-10-24T22:30:00Z')), '2026-10-25'); // 01:30 next day in Nairobi
    assert.equal(dateTimeNairobi('2026-10-24T06:05:00Z', 'en'), '24 Oct 2026, 09:05');
  });
});

describe('commands and windows', () => {
  test('nav commands', () => {
    assert.equal(parseNavCommand('0'), 'back');
    assert.equal(parseNavCommand('Nyuma'), 'back');
    assert.equal(parseNavCommand('#'), 'main');
    assert.equal(parseNavCommand('menu kuu'), 'main');
    assert.equal(parseNavCommand('Msaada'), 'help');
    assert.equal(parseNavCommand('lugha'), 'language');
    assert.equal(parseNavCommand('tuma tena'), 'resend');
    assert.equal(parseNavCommand('ghairi'), 'cancel');
    assert.equal(parseNavCommand('PYP-0001'), null);
  });
  test('main-menu keywords', () => {
    for (const k of ['WATCH', 'watch', ' Landlord ', 'MWENYE NYUMBA', 'mwenye   nyumba']) assert.ok(isWatchKeyword(k), k);
    for (const k of ['1', 'watcher', 'mwenye']) assert.ok(!isWatchKeyword(k), k);
  });
  test('yes/no and otp', () => {
    assert.equal(parseYesNo('Ndiyo'), 'yes');
    assert.equal(parseYesNo('hapana'), 'no');
    assert.equal(parseYesNo('maybe'), null);
    assert.equal(parseOtp('123 456'), '123456');
    assert.equal(parseOtp('12345'), null);
    assert.equal(parseOtp('abcdef'), null);
  });
  test('24 h service window', () => {
    const now = Date.parse('2026-10-24T12:00:00Z');
    assert.ok(insideServiceWindow(now / 1000 - 60, now));
    assert.ok(!insideServiceWindow(now / 1000 - 25 * 3600, now));
    assert.ok(insideServiceWindow(undefined, now));
    assert.ok(insideServiceWindow(String(now / 1000 - 3600), now));
  });
});

describe('message-id dedup', () => {
  test('first sight is processed, a retry is not, list stays bounded', () => {
    let seen: string[] = [];
    const a = dedupDecision(seen, 'wamid.1');
    assert.equal(a.duplicate, false);
    seen = a.next;
    assert.equal(dedupDecision(seen, 'wamid.1').duplicate, true);
    for (let i = 0; i < 100; i++) seen = dedupDecision(seen, `id${i}`).next;
    assert.ok(seen.length <= 25);
    assert.equal(dedupDecision(undefined, 'x').duplicate, false);
  });
});
