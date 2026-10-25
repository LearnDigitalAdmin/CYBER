import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HttpLwApi, HttpPost, LwError, isLwError, normalizeErrorCode, createWatchApi } from '../../services/watch.api';
import { LW_ERROR_CODES } from '../../types/watch.types';
import { MockLwApi } from '../../services/watch.mock';
import { getLwApiUrl, LW_DEFAULT_API_URL } from '../../config/watch.config';

const KEY = 'SUPER-SECRET-KEY-123';
const mk = (post: HttpPost) => new HttpLwApi({ actorPhone: '+254712345678', url: 'https://x.test/lwBotApi', getKey: () => KEY, post });
const ok = (data: unknown): HttpPost => async () => ({ status: 200, data: { ok: true, data } });
const fail = (error: unknown): HttpPost => async () => ({ status: 200, data: { ok: false, error } });

describe('API client: request shape', () => {
  test('sends action, actor.phone, params, and the key header', async () => {
    let seen: { url: string; body: any; headers: Record<string, string> } | undefined;
    const api = mk(async (url, body, headers) => {
      seen = { url, body, headers };
      return { status: 200, data: { ok: true, data: { found: false } } };
    });
    const res = await api.lookupProperty('PYP-0001');
    assert.deepEqual(res, { found: false });
    assert.equal(seen!.url, 'https://x.test/lwBotApi');
    assert.deepEqual(seen!.body, { action: 'lookupProperty', actor: { phone: '+254712345678' }, ownerId: 'PYP-0001' });
    assert.equal(seen!.headers['x-lw-key'], KEY);
    assert.equal(seen!.headers['Content-Type'], 'application/json');
  });

  test('every method uses the contract action name and params', async () => {
    const bodies: any[] = [];
    const api = mk(async (_u, body) => {
      bodies.push(body);
      return { status: 200, data: { ok: true, data: {} } };
    });
    await api.connect('PYP-0001');
    await api.disconnect('PYP-0001');
    await api.listConnections();
    await api.unlockSendOtp('PYP-0001', 'sw');
    await api.unlockVerifyOtp('PYP-0001', '123456');
    await api.getSnapshot('PYP-0001', '2026-09', 'en');
    await api.getSnapshot('PYP-0001', undefined, 'en');
    await api.transcriptQuota('PYP-0001');
    await api.transcriptStart('PYP-0001', '2026-09', 'sw');
    await api.transcriptResendOtp('r1');
    await api.transcriptVerifyOtp('r1', '123456');
    await api.transcriptPay('r1', '+254712345678');
    await api.transcriptStatus('r1');
    await api.transcriptList('PYP-0001');
    assert.deepEqual(
      bodies.map((b) => b.action),
      ['connect', 'disconnect', 'listConnections', 'unlockSendOtp', 'unlockVerifyOtp', 'getSnapshot', 'getSnapshot', 'transcriptQuota',
        'transcriptStart', 'transcriptResendOtp', 'transcriptVerifyOtp', 'transcriptPay', 'transcriptStatus', 'transcriptList']
    );
    assert.equal(bodies[5].month, '2026-09');
    assert.equal('month' in bodies[6], false, 'month omitted when latest');
    assert.equal(bodies[3].lang, 'sw');
    assert.deepEqual(bodies[11], { action: 'transcriptPay', actor: { phone: '+254712345678' }, requestId: 'r1', phone: '+254712345678' });
  });

  test('default URL, env override', () => {
    const prev = process.env.LW_API_URL;
    delete process.env.LW_API_URL;
    assert.equal(getLwApiUrl(), LW_DEFAULT_API_URL);
    assert.equal(LW_DEFAULT_API_URL, 'https://africa-south1-plot-9fd6e.cloudfunctions.net/lwBotApi');
    process.env.LW_API_URL = 'https://other.test/x';
    assert.equal(getLwApiUrl(), 'https://other.test/x');
    if (prev === undefined) delete process.env.LW_API_URL;
    else process.env.LW_API_URL = prev;
  });

  test('LW_MOCK=1 switches to the in-memory mock', () => {
    process.env.LW_MOCK = '1';
    assert.ok(createWatchApi('+254700000001') instanceof MockLwApi);
    delete process.env.LW_MOCK;
    assert.ok(createWatchApi('+254700000001') instanceof HttpLwApi);
  });
});

describe('API client: error mapping', () => {
  for (const code of LW_ERROR_CODES) {
    test(`passes ${code} through with retryAfterSec / attemptsLeft`, async () => {
      const api = mk(fail({ code, message: 'm', retryAfterSec: 42, attemptsLeft: 3 }));
      await assert.rejects(api.listConnections(), (e: unknown) => {
        assert.ok(isLwError(e));
        assert.equal((e as LwError).code, code);
        assert.equal((e as LwError).retryAfterSec, 42);
        assert.equal((e as LwError).attemptsLeft, 3);
        return true;
      });
    });
  }

  test('unknown code becomes LW_UNAVAILABLE', async () => {
    await assert.rejects(mk(fail({ code: 'LW_WHAT', message: 'x' })).listConnections(), { code: 'LW_UNAVAILABLE' });
    assert.equal(normalizeErrorCode(undefined), 'LW_UNAVAILABLE');
    assert.equal(normalizeErrorCode(42), 'LW_UNAVAILABLE');
  });

  test('HTTP 401 / 500 / malformed / empty / network error all become LW_UNAVAILABLE', async () => {
    await assert.rejects(mk(async () => ({ status: 401, data: {} })).listConnections(), { code: 'LW_UNAVAILABLE' });
    await assert.rejects(mk(async () => ({ status: 500, data: {} })).listConnections(), { code: 'LW_UNAVAILABLE' });
    await assert.rejects(mk(async () => ({ status: 200, data: 'oops' })).listConnections(), { code: 'LW_UNAVAILABLE' });
    await assert.rejects(mk(async () => ({ status: 200, data: { ok: true } })).listConnections(), { code: 'LW_UNAVAILABLE' });
    await assert.rejects(mk(async () => ({ status: 200, data: null })).listConnections(), { code: 'LW_UNAVAILABLE' });
    await assert.rejects(
      mk(async () => {
        throw Object.assign(new Error('boom'), { code: 'ECONNABORTED' });
      }).listConnections(),
      { code: 'LW_UNAVAILABLE' }
    );
  });

  test('the API key never appears in errors or logs', async () => {
    const logs: string[] = [];
    const orig = { log: console.log, warn: console.warn, error: console.error };
    console.log = console.warn = console.error = (...a: unknown[]) => void logs.push(a.map(String).join(' '));
    try {
      const boom: HttpPost = async (_u, _b, headers) => {
        // simulate an axios-like error that embeds the request headers
        throw Object.assign(new Error('failed'), { code: 'ECONNRESET', config: { headers } });
      };
      for (const post of [boom, async () => ({ status: 401, data: {} }), fail({ code: 'LW_NOT_FOUND', message: 'nope' })]) {
        try {
          await mk(post as HttpPost).listConnections();
        } catch (e) {
          assert.ok(!JSON.stringify(e).includes(KEY));
          assert.ok(!String((e as Error).message).includes(KEY));
          assert.ok(!String((e as Error).stack).includes(KEY));
        }
      }
    } finally {
      Object.assign(console, orig);
    }
    assert.ok(logs.length > 0, 'failures are logged');
    assert.ok(!logs.join('\n').includes(KEY), 'but never with the key');
  });

  test('success returns data untouched', async () => {
    const data = { connections: [{ ownerId: 'PYP-0001' }] };
    assert.deepEqual(await mk(ok(data)).listConnections(), data);
  });
});
