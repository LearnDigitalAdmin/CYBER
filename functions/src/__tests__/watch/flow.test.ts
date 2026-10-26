import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRig, connectFirst, textOf, Rig } from './harness';
import { STATE } from '../../constants/states';
import { mainMenuReply } from '../../utils/ui';
import { isWatchState } from '../../handlers/watch.handler';
import { Outbound } from '../../types/watch.types';

const OWNER = '+254712345678'; // PYP-0001 owner phone in the mock
const docs = (r: Rig) => r.sent.filter((o): o is Extract<Outbound, { kind: 'document' }> => o.kind === 'document');
const rowsOf = (o: Outbound) => (o.kind === 'list' ? o.rows : []);

describe('entry and routing', () => {
  test('main menu lists Landlord Watch (value 7) in both languages; WATCH_* states are routed to the module', () => {
    for (const lang of ['en', 'sw'] as const) {
      const menu = mainMenuReply(lang);
      assert.equal(menu.kind, 'list');
      const watch = rowsOf(menu).find((r) => r.id === 'ui:MAIN_MENU:7');
      assert.ok(watch && /Landlord Watch/.test(watch.title), lang);
    }
    for (const s of Object.values(STATE).filter((v) => v.startsWith('WATCH_'))) assert.ok(isWatchState(s), s);
    assert.ok(!isWatchState(STATE.MAIN_MENU) && !isWatchState(STATE.MYCHAMA_MENU) && !isWatchState(undefined));
  });

  for (const lang of ['en', 'sw'] as const) {
    test(`first time (${lang}): asks for the Owner ID, rejects junk, says not found, then confirms and connects`, async () => {
      const r = makeRig({ lang });
      await r.start();
      assert.equal(r.state(), STATE.WATCH_ADD_ID);
      assert.match(r.lastText(), /PYP-0001/);
      assert.match(r.lastText(), lang === 'en' ? /Landlord Watch/ : /Fuatilia mali yako/);

      await r.say('hello');
      assert.match(r.lastText(), lang === 'en' ? /doesn't look like an Owner ID/ : /si Owner ID sahihi/);
      assert.equal(r.state(), STATE.WATCH_ADD_ID);
      assert.ok(!r.calls.includes('lookupProperty'), 'junk never reaches the backend');

      await r.say('pyp-9999');
      assert.match(r.lastText(), lang === 'en' ? /No property found/ : /Hakuna mali/);
      assert.equal(r.state(), STATE.WATCH_ADD_ID);

      await r.say('pyp 0001');
      assert.equal(r.state(), STATE.WATCH_CONFIRM);
      const confirm = r.last();
      assert.equal(confirm.kind, 'buttons');
      assert.match(textOf(confirm), /Sunrise Apartments/);
      assert.match(textOf(confirm), /Naivasha, Nakuru/);
      assert.ok(!/•|07\d\d/.test(textOf(confirm)), 'shows only name and address, no phone');
      assert.deepEqual((confirm as any).buttons.map((b: any) => b.title), lang === 'en' ? ['Yes', 'No'] : ['Ndiyo', 'Hapana']);

      await r.tap('yes');
      assert.equal(r.state(), STATE.WATCH_MENU);
      assert.equal(r.ctx().ownerId, 'PYP-0001');
      assert.ok(r.calls.includes('connect'));
      assert.equal(r.last().kind, 'list');
      assert.match(r.allText(), lang === 'en' ? /Connected: \*Sunrise Apartments\*/ : /Imeunganishwa: \*Sunrise Apartments\*/);
    });
  }

  test('"No" cancels without connecting; typed Yes/No and Ndiyo work too', async () => {
    const r = makeRig();
    await r.start();
    await r.say('PYP-0001');
    await r.tap('no');
    assert.equal(r.state(), STATE.WATCH_ADD_ID);
    assert.ok(!r.calls.includes('connect'));
    await r.say('PYP-0001');
    await r.say('Ndiyo');
    assert.equal(r.state(), STATE.WATCH_MENU);
  });

  test('watch menu fits a WhatsApp list (≤ 10 rows), hides Unlock when already open, shows it when hidden', async () => {
    const hidden = makeRig();
    await connectFirst(hidden);
    const rows = rowsOf(hidden.last());
    assert.ok(rows.length <= 10);
    assert.ok(rows.some((x) => x.id === 'lw:unlock'));
    assert.match(hidden.lastText(), /hidden/);

    const open = makeRig({ actor: OWNER });
    await connectFirst(open);
    assert.ok(!rowsOf(open.last()).some((x) => x.id === 'lw:unlock'));
    assert.match(open.lastText(), /visible/);
    assert.ok(rowsOf(open.last()).length <= 10);
  });

  test('a user with one connected property goes straight to the menu; with several, to the picker', async () => {
    const r = makeRig();
    await connectFirst(r);
    await r.say('#');
    assert.equal(r.state(), STATE.MAIN_MENU);
    await r.start();
    assert.equal(r.state(), STATE.WATCH_MENU);
    await r.tap('props');
    await r.tap('add');
    await r.say('PYP-0002');
    await r.tap('yes');
    await r.say('#');
    await r.start();
    assert.equal(r.last().kind, 'list');
    assert.match(r.lastText(), /\(2\)/);
    assert.equal(r.ctx().pick, 'prop');
  });
});

describe('numbered fallback and unexpected input', () => {
  test('typed numbers map to the options of the last list; "0" goes back; "#" leaves', async () => {
    const r = makeRig({ actor: OWNER });
    await connectFirst(r);
    await r.say('1'); // Summary
    assert.match(r.lastText(), /KES 56,500/);
    await r.say('0'); // back to the watch menu
    assert.equal(r.last().kind, 'list');
    await r.say('3'); // Who hasn't paid
    assert.match(r.lastText(), /Daniel Otieno/);
    await r.say('0');
    await r.say('0'); // from the menu: back to the main menu
    assert.equal(r.state(), STATE.MAIN_MENU);
    assert.equal(r.lastText(), 'MAIN_MENU_en');
  });

  test('unexpected text, stale buttons and wrong-state buttons re-prompt and never throw', async () => {
    const r = makeRig({ actor: OWNER });
    await connectFirst(r);
    await r.say('blah blah');
    assert.match(r.allText(), /didn't understand/);
    assert.equal(r.last().kind, 'list');
    await r.say('42');
    await r.tap('nonsense');
    await r.tap('yes');
    await r.tap('m:2026-07');
    assert.equal(r.state(), STATE.WATCH_MENU);
    await r.sent.length; // still alive
    await r.say('');
    assert.equal(r.state(), STATE.WATCH_MENU);
  });

  test('Kiswahili: menu, numbers and typed commands', async () => {
    const r = makeRig({ actor: OWNER, lang: 'sw' });
    await connectFirst(r);
    assert.match(r.lastText(), /Muhtasari/);
    assert.match(r.lastText(), /Waliolipa/);
    assert.match(r.lastText(), /Wasiolipa/);
    await r.say('msaada');
    assert.match(r.lastText(), /Msaada wa Landlord Watch/);
    await r.say('menu kuu');
    assert.equal(r.lastText(), 'MAIN_MENU_sw');
  });

  test('language switch inside Watch persists and re-renders', async () => {
    const r = makeRig({ actor: OWNER });
    await connectFirst(r);
    await r.say('lugha');
    assert.equal((r.last() as any).buttons.length, 3);
    await r.tap('lang:sw');
    assert.equal(r.lang(), 'sw');
    assert.match(r.allText(), /Lugha: Kiswahili/);
    assert.match(r.lastText(), /Muhtasari/);
    await r.tap('settings');
    await r.tap('lang:en');
    assert.equal(r.lang(), 'en');
  });
});

describe('summary, lists, months', () => {
  test('summary, paid, unpaid, money, months, trend', async () => {
    const r = makeRig({ actor: OWNER });
    await connectFirst(r);
    await r.tap('sum');
    assert.match(r.lastText(), /Net amount to you.*KES 25,600/);
    await r.tap('paid');
    assert.match(r.lastText(), /Amina Wanjiru/);
    await r.tap('unpaid');
    assert.match(r.lastText(), /Daniel Otieno/);
    await r.tap('money');
    assert.match(r.lastText(), /Estimate/);
    await r.tap('months');
    const rows = rowsOf(r.last());
    assert.deepEqual(rows.map((x) => x.id), ['lw:m:2026-10', 'lw:m:2026-09', 'lw:m:2026-08', 'lw:trend']);
    await r.tap('m:2026-09');
    assert.equal(r.ctx().month, '2026-09');
    assert.match(r.lastText(), /September 2026/);
    assert.match(r.lastText(), /KES 56,500/);
    await r.tap('menu');
    assert.match(r.lastText(), /September 2026/);
    await r.tap('months');
    await r.tap('trend');
    assert.match(r.lastText(), /August 2026[\s\S]*October 2026/);
  });

  test('hidden level: names and phones come back masked and Unlock is offered', async () => {
    const r = makeRig();
    await connectFirst(r);
    await r.tap('unpaid');
    assert.match(r.lastText(), /D••• O•••/);
    assert.ok(!/Daniel/.test(r.allText()));
    assert.ok((r.last() as any).buttons.some((b: any) => b.id === 'lw:unlock'));
  });
});

describe('unlock with a code and the 60 s cool-down', () => {
  async function toCodeState(r: Rig) {
    await connectFirst(r);
    await r.tap('unlock');
    assert.match(r.lastText(), /owner's phone/);
    await r.tap('usend');
    assert.equal(r.state(), STATE.WATCH_UNLOCK_CODE);
    assert.match(r.lastText(), /07•• ••• 678/, 'only the masked number is ever shown');
    assert.ok(!r.allText().includes('123456'));
  }

  test('wrong code shows attempts left, right code unlocks and tenant names appear', async () => {
    const r = makeRig();
    await toCodeState(r);
    await r.say('000111');
    assert.match(r.lastText(), /Wrong code\. 4 tries left/);
    assert.equal(r.state(), STATE.WATCH_UNLOCK_CODE);
    await r.say('banana');
    assert.match(r.lastText(), /type the 6-digit code/);
    await r.say('123 456');
    assert.equal(r.state(), STATE.WATCH_MENU);
    assert.match(r.allText(), /Tenant details are now visible until/);
    await r.tap('unpaid');
    assert.match(r.lastText(), /Daniel Otieno/);
  });

  test('five wrong tries lock the code and offer a new one', async () => {
    const r = makeRig();
    await toCodeState(r);
    for (let i = 0; i < 5; i++) await r.say('111111');
    assert.match(r.lastText(), /locked/);
    assert.match(r.lastText(), /Resend code/);
  });

  test('resend before 60 s is refused locally with the remaining time; after 60 s it sends a new code', async () => {
    const r = makeRig();
    await toCodeState(r);
    const sends = () => r.calls.filter((c) => c === 'unlockSendOtp').length;
    assert.equal(sends(), 1);
    r.clock.advance(20_000);
    await r.tap('resend');
    assert.match(r.lastText(), /new code in 40 seconds/);
    assert.equal(sends(), 1, 'no backend call during the cool-down');
    await r.say('resend');
    assert.equal(sends(), 1);
    r.clock.advance(41_000);
    await r.tap('resend');
    assert.equal(sends(), 2);
    assert.match(r.lastText(), /We sent a 6-digit/);
  });

  test('server-side cool-down (LW_OTP_COOLDOWN) is mapped to a friendly wait message, Kiswahili too', async () => {
    const r = makeRig({ lang: 'sw' });
    await connectFirst(r);
    await r.tap('unlock');
    await r.tap('usend');
    // lose the local timer (e.g. session restored), the server still enforces 60 s
    r.ctx().resendAt = 0;
    r.clock.advance(5_000);
    await r.tap('resend');
    assert.match(r.lastText(), /Tafadhali subiri sekunde 55 kabla ya kuomba nambari mpya/);
  });

  test('an expired code asks for a new one', async () => {
    const r = makeRig();
    await toCodeState(r);
    r.clock.advance(6 * 60_000);
    await r.say('123456');
    assert.match(r.lastText(), /expired/);
    await r.tap('resend');
    await r.say('123456');
    assert.equal(r.state(), STATE.WATCH_MENU);
  });

  test('one unlock covers every connected property that shares the owner phone', async () => {
    const r = makeRig();
    await toCodeState(r);
    await r.say('123456');
    await r.tap('props');
    await r.tap('add');
    await r.say('PYP-0003'); // Baraka Flats shares the owner phone
    await r.tap('yes');
    assert.match(r.lastText(), /visible/);
    assert.ok(!rowsOf(r.last()).some((x) => x.id === 'lw:unlock'));
  });

  test('cancel returns to the menu', async () => {
    const r = makeRig();
    await toCodeState(r);
    await r.tap('cancel');
    assert.equal(r.state(), STATE.WATCH_MENU);
  });
});

describe('transcript state machine', () => {
  async function pickMonth(r: Rig, m: string) {
    await r.tap('tr');
    assert.match(r.lastText(), /Which month|mwezi upi/);
    await r.tap('m:' + m);
  }

  test('free transcript: quota → code → PDF sent as a document with a caption, no signed URL in text', async () => {
    const r = makeRig();
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    assert.match(r.lastText(), /This one is \*free\* \(1 of 1 free this month\)/);
    await r.tap('tsend');
    assert.equal(r.state(), STATE.WATCH_TR_CODE);
    assert.ok(r.ctx().requestId);
    await r.say('654321');
    assert.match(r.lastText(), /Wrong code\. 4 tries left/);
    await r.say('123456');
    assert.equal(docs(r).length, 1);
    const d = docs(r)[0];
    assert.equal(d.url, 'https://example.com/transcript.pdf');
    assert.equal(d.filename, 'Landlord-Watch-PYP-0001-2026-10.pdf');
    assert.match(d.caption!, /October 2026 · PYP-0001/);
    assert.ok(!r.sent.filter((o) => o.kind !== 'document').some((o) => textOf(o).includes('example.com')), 'URL never shown as text');
    assert.equal(r.state(), STATE.WATCH_MENU);
    assert.equal(r.ctx().requestId, undefined, 'request id cleared after delivery');
    assert.ok(!JSON.stringify(r.ctx()).includes('example.com'), 'signed URL is never persisted');
  });

  test('second transcript the same month is paid: asks for the number, STK push, polls, then sends the PDF', async () => {
    const r = makeRig({ actor: '+254722555666' });
    await connectFirst(r);
    // use the free one
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    await r.say('123456');
    assert.equal(docs(r).length, 1);
    // next one costs money
    await pickMonth(r, '2026-09');
    assert.match(r.lastText(), /free transcript for this month is used\. This one costs \*KES 99\*/);
    r.clock.advance(61_000);
    await r.tap('tsend');
    await r.say('123456');
    assert.equal(r.state(), STATE.WATCH_TR_PHONE);
    assert.match(r.lastText(), /KES 99/);
    assert.match(r.lastText(), /0722555666/);
    assert.deepEqual((r.last() as any).buttons.map((b: any) => b.title), ['My number', 'Another number', 'Cancel']);

    const before = r.clock.now();
    await r.tap('mine');
    assert.match(r.allText(), /Check your phone \(0722555666\)/);
    assert.equal(docs(r).length, 2, 'PDF delivered once the payment confirmed');
    const waited = r.clock.now() - before;
    assert.ok(waited >= 6000 && waited <= 15_000, `waited ${waited} ms`);
    assert.ok(!r.allText().includes('Still waiting'), 'fast payment: no nudge');
    const statusCalls = r.calls.filter((c) => c === 'transcriptStatus').length;
    assert.ok(statusCalls >= 3 && statusCalls <= 6, `status calls ${statusCalls}`);
    assert.equal(r.state(), STATE.WATCH_MENU);
  });

  test('another number: typed, validated, then charged', async () => {
    const r = makeRig({ actor: '+254722555666' });
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    await r.say('123456');
    await pickMonth(r, '2026-09');
    r.clock.advance(61_000);
    await r.tap('tsend');
    await r.say('123456');
    await r.tap('other');
    assert.match(r.lastText(), /Type the Safaricom number/);
    await r.say('12345');
    assert.match(r.lastText(), /not a valid Safaricom number/);
    await r.say('0733 000 111');
    assert.equal(docs(r).length, 2);
    assert.match(r.allText(), /Check your phone \(0733000111\)/);
  });

  test('failed payment: clear retry path, then success', async () => {
    const r = makeRig({ actor: '+254700000000' }); // this number makes the mock payment fail
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    await r.say('123456');
    await pickMonth(r, '2026-09');
    r.clock.advance(61_000);
    await r.tap('tsend');
    await r.say('123456');
    await r.tap('mine');
    assert.match(r.lastText(), /payment did not go through/);
    assert.deepEqual((r.last() as any).buttons.map((b: any) => b.title), ['Try again', 'Cancel']);
    assert.equal(docs(r).length, 1);
    await r.tap('retry');
    assert.equal(r.state(), STATE.WATCH_TR_PHONE);
    await r.say('0711000222');
    assert.equal(docs(r).length, 2);
  });

  test('payment that takes too long: one "still waiting" nudge, then Check status / Cancel; Check status delivers later', async () => {
    const r = makeRig({ actor: '+254722555666', mock: { payDelayMs: 120_000 } });
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    await r.say('123456');
    await pickMonth(r, '2026-09');
    r.clock.advance(61_000);
    await r.tap('tsend');
    await r.say('123456');
    const t0 = r.clock.now();
    await r.tap('mine');
    assert.ok(r.clock.now() - t0 >= 90_000 && r.clock.now() - t0 < 95_000);
    assert.equal(r.sent.filter((o) => textOf(o).includes('Still waiting')).length, 1);
    assert.match(r.lastText(), /have not seen the payment yet/);
    assert.deepEqual((r.last() as any).buttons.map((b: any) => b.title), ['Check status', 'Cancel']);
    assert.equal(r.state(), STATE.WATCH_TR_PAYING);
    assert.ok(r.ctx().requestId);

    await r.tap('status'); // still pending
    assert.match(r.lastText(), /Not confirmed yet/);
    r.clock.advance(60_000);
    await r.tap('status'); // payment now confirmed: keeps polling until the PDF is ready, no extra tap needed
    assert.match(r.allText(), /Preparing your PDF/);
    assert.equal(docs(r).length, 2);
    assert.equal(r.state(), STATE.WATCH_MENU);
  });

  test('cancel while waiting stops the poll quietly', async () => {
    const r = makeRig({ actor: '+254722555666', mock: { payDelayMs: 120_000 } });
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    await r.say('123456');
    await pickMonth(r, '2026-09');
    r.clock.advance(61_000);
    await r.tap('tsend');
    await r.say('123456');
    // while the poll runs, another message ("Cancel") is handled and moves the persisted state on
    r.onSleep(async (n) => {
      if (n === 3) await r.store().write(STATE.WATCH_MENU, {});
    });
    const countBefore = r.sent.length;
    await r.tap('mine');
    const after = r.sent.slice(countBefore).map(textOf).join('|');
    assert.ok(!/payment yet|Still waiting/.test(after), 'no timeout or nudge after cancel: ' + after);
    assert.equal(docs(r).length, 1);
  });

  test('already generated: offered again with no new code and no new charge', async () => {
    const r = makeRig();
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    await r.say('123456');
    assert.equal(docs(r).length, 1);
    const starts = () => r.calls.filter((c) => c === 'transcriptStart').length;
    await pickMonth(r, '2026-10');
    assert.match(r.lastText(), /already have the October 2026 transcript \(available until/);
    assert.deepEqual((r.last() as any).buttons.map((b: any) => b.title), ['Send again', 'Make a new one', 'Cancel']);
    await r.tap('again');
    assert.equal(docs(r).length, 2);
    assert.equal(starts(), 1, 'no new OTP / request');
    assert.equal(r.calls.filter((c) => c === 'transcriptVerifyOtp').length, 1);
    // after the expiry time it is no longer offered
    r.clock.advance(25 * 3600_000);
    await pickMonth(r, '2026-10');
    assert.match(r.lastText(), /\*free\*|costs/);
  });

  test('a document WhatsApp refuses keeps the request so "Send again" fetches a fresh link', async () => {
    const r = makeRig();
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    let fail = true;
    r.setSendResult((o) => ({ ok: !(o.kind === 'document' && fail) }));
    await r.say('123456');
    assert.match(r.lastText(), /could not be sent/);
    assert.ok(r.ctx().requestId);
    fail = false;
    await r.tap('again');
    assert.equal(docs(r).length, 2);
    assert.equal(r.calls.filter((c) => c === 'transcriptStart').length, 1);
  });

  test('transcript code: resend honours the cool-down; cancel returns to the menu', async () => {
    const r = makeRig();
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    await r.tap('tsend');
    await r.tap('resend');
    assert.match(r.lastText(), /new code in/);
    assert.equal(r.calls.filter((c) => c === 'transcriptResendOtp').length, 0);
    r.clock.advance(61_000);
    await r.tap('resend');
    assert.equal(r.calls.filter((c) => c === 'transcriptResendOtp').length, 1);
    await r.tap('cancel');
    assert.equal(r.state(), STATE.WATCH_MENU);
    assert.equal(r.ctx().requestId, undefined);
  });

  test('Kiswahili transcript flow end to end', async () => {
    const r = makeRig({ lang: 'sw' });
    await connectFirst(r);
    await pickMonth(r, '2026-10');
    assert.match(r.lastText(), /Hii ni \*bure\*/);
    await r.tap('tsend');
    assert.match(r.lastText(), /nambari ya uthibitisho/);
    await r.say('123456');
    assert.match(docs(r)[0].caption!, /Taarifa ya Oktoba 2026/);
    assert.match(r.lastText(), /Taarifa yako iko hapo juu/);
  });
});

describe('properties: switch, add, disconnect, paging, limit', () => {
  test('25 properties are pageable, rows ≤ 10, the 26th hits the limit message', async () => {
    const r = makeRig();
    for (let i = 100; i < 125; i++) await r.api.connect(`PYP-0${i}`);
    await r.start();
    assert.equal(r.last().kind, 'list');
    assert.ok(rowsOf(r.last()).length <= 10);
    assert.match(r.lastText(), /\(25\)/);
    const seen = new Set<string>();
    for (let p = 0; p < 5; p++) {
      rowsOf(r.last()).filter((x) => x.id.startsWith('lw:p:')).forEach((x) => seen.add(x.id));
      assert.ok(rowsOf(r.last()).length <= 10);
      if (p < 4) await r.tap(`pgp:${p + 1}`);
    }
    assert.equal(seen.size, 25);
    await r.tap('add');
    await r.say('PYP-0125');
    await r.tap('yes');
    assert.match(r.allText(), /maximum number of connected properties/);
    assert.equal(r.last().kind, 'list');
  });

  test('switch property, then disconnect with confirmation', async () => {
    const r = makeRig();
    await connectFirst(r);
    await r.tap('props');
    await r.tap('add');
    await r.say('PYP-0002');
    await r.tap('yes');
    assert.equal(r.ctx().ownerId, 'PYP-0002');
    await r.tap('props');
    assert.ok(rowsOf(r.last()).some((x) => x.title.startsWith('✓ Mwangaza')));
    await r.tap('p:PYP-0001');
    assert.equal(r.ctx().ownerId, 'PYP-0001');
    assert.match(r.lastText(), /Sunrise Apartments/);

    await r.tap('props');
    await r.tap('disc');
    assert.match(r.lastText(), /Which property do you want to disconnect/);
    await r.tap('d:PYP-0002');
    assert.equal(r.state(), STATE.WATCH_CONFIRM);
    assert.match(r.lastText(), /Disconnect \*Mwangaza Court\*/);
    await r.tap('no');
    assert.ok(!r.calls.includes('disconnect'));
    await r.tap('disc');
    await r.tap('d:PYP-0002');
    await r.tap('yes');
    assert.ok(r.calls.includes('disconnect'));
    assert.match(r.allText(), /Disconnected: PYP-0002/);
    assert.equal(r.state(), STATE.WATCH_MENU);
  });
});

describe('error handling', () => {
  test('lookup rate limit is explained with the wait time', async () => {
    const r = makeRig();
    await r.start();
    for (let i = 0; i < 20; i++) await r.say(`PYP-9${String(i).padStart(3, '0')}`);
    await r.say('PYP-9999');
    assert.match(r.lastText(), /Too many attempts\. Please try again in 60 minutes/);
    assert.equal(r.state(), STATE.WATCH_ADD_ID);
  });

  test('owner without a phone on file gets the explanation', async () => {
    const r = makeRig();
    await r.start();
    await r.say('PYP-0004');
    assert.match(r.lastText(), /no owner phone number on file/);
  });

  test('backend down: friendly message, never a crash, and the user can still reach the main menu', async () => {
    const r = makeRig({ actor: OWNER });
    await connectFirst(r);
    (r.backend as any).getSnapshot = () => {
      throw new Error('socket hang up'); // not even an LwError
    };
    await r.tap('sum');
    assert.match(r.lastText(), /Something went wrong on our side/);
    assert.deepEqual((r.last() as any).buttons.map((b: any) => b.title), ['Watch menu', 'Main menu']);
    await r.tap('main');
    assert.equal(r.state(), STATE.MAIN_MENU);
  });

  test('when the 24 h window is closed the module stops sending within that message instead of looping', async () => {
    const r = makeRig({ actor: OWNER });
    await r.start();
    await r.say('PYP-0001');
    const n = r.sent.length;
    r.setSendResult(() => ({ ok: false, errorCode: 131047 }));
    await r.tap('yes'); // would send "Connected" and then the menu
    assert.equal(r.sent.length, n + 1, 'second send skipped once Meta says the window is closed');
    assert.equal(r.state(), STATE.WATCH_MENU, 'state still saved');
  });
});

describe('privacy: nothing sensitive in logs or session', () => {
  test('a full transcript run logs no OTP, URL, tenant name/phone, and persists only the allowed slice', async () => {
    const logs: string[] = [];
    const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
    console.log = console.warn = console.error = console.info = console.debug = (...a: unknown[]) => void logs.push(a.map(String).join(' '));
    const persisted: string[] = [];
    try {
      const r = makeRig({ actor: OWNER });
      await connectFirst(r);
      for (const step of [() => r.tap('unpaid'), () => r.tap('tr'), () => r.tap('m:2026-10'), () => r.tap('tsend'), () => r.say('000000'), () => r.say('123456'), () => r.tap('sum')]) {
        await step();
        persisted.push(JSON.stringify(r.ctx()));
      }
      await r.say('not a command');
      assert.equal(docs(r).length, 1);
    } finally {
      Object.assign(console, orig);
    }
    const all = logs.join('\n') + persisted.join('\n');
    for (const secret of ['123456', '000000', 'example.com', 'Daniel', 'Amina', '0722111222', '+254722111222', '+254711333444', 'transcript.pdf'])
      assert.ok(!all.includes(secret), `leaked ${secret}`);
    const allowed = new Set(['ownerId', 'month', 'page', 'pick', 'pendingOwnerId', 'confirm', 'trMonth', 'requestId', 'resendAt', 'screen', 'opts']);
    for (const p of persisted) for (const k of Object.keys(JSON.parse(p))) assert.ok(allowed.has(k), `unexpected persisted key ${k}`);
  });
});
