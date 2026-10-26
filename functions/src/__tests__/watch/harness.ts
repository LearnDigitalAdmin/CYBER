/** Shared test harness: mock backend + fake clock + in-memory session store + capturing sender. Not a test file. */
import { Lang, LwApi, Outbound, SendResult, WatchCtx } from '../../types/watch.types';
import { MockBackend, MockLwApi, MockOptions } from '../../services/watch.mock';
import { WatchDeps, WatchFlow, WatchStore } from '../../handlers/watch.handler';
import { STATE } from '../../constants/states';

export const T0 = Date.parse('2026-10-24T06:00:00Z'); // 09:00 Nairobi

export class FakeClock {
  t = T0;
  now = (): number => this.t;
  sleep = async (ms: number): Promise<void> => {
    this.t += ms;
  };
  advance(ms: number): void {
    this.t += ms;
  }
}

export interface Rig {
  clock: FakeClock;
  backend: MockBackend;
  api: LwApi;
  calls: string[];
  sent: Outbound[];
  state: () => string;
  ctx: () => WatchCtx;
  lang: () => Lang;
  start: () => Promise<void>;
  say: (text: string) => Promise<void>;
  tap: (id: string) => Promise<void>;
  last: () => Outbound;
  lastText: () => string;
  allText: () => string;
  store: () => WatchStore;
  setSendResult: (fn: (o: Outbound) => SendResult) => void;
  onSleep: (fn: (n: number) => Promise<void> | void) => void;
}

export const textOf = (o: Outbound | undefined): string => {
  if (!o) return '';
  switch (o.kind) {
    case 'text':
      return o.text;
    case 'buttons':
      return o.body + ' [' + o.buttons.map((b) => b.title).join('|') + ']';
    case 'list':
      return o.body + ' [' + o.rows.map((r) => r.title).join('|') + ']';
    case 'document':
      return o.caption ?? '';
  }
};

export function makeRig(opts: { actor?: string; lang?: Lang; mock?: MockOptions } = {}): Rig {
  const clock = new FakeClock();
  const actor = opts.actor ?? '+254799111222'; // NOT the owner phone, so details start hidden
  const backend = new MockBackend({ now: clock.now, ...opts.mock });
  const calls: string[] = [];
  const raw = new MockLwApi(backend, actor);
  // record every API call name
  const api = new Proxy(raw, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as LwApi;

  let state: string = STATE.MAIN_MENU;
  let ctx: WatchCtx = {};
  let lang: Lang = opts.lang ?? 'en';
  const sent: Outbound[] = [];
  let sendResult: (o: Outbound) => SendResult = () => ({ ok: true });
  let sleepHook: (n: number) => Promise<void> | void = () => undefined;
  let sleeps = 0;

  const store: WatchStore = {
    async read() {
      return { state, ctx: { ...ctx } };
    },
    async write(s, c) {
      state = s;
      ctx = { ...c };
    },
    async setLanguage(l) {
      lang = l;
    },
    async leave() {
      state = STATE.MAIN_MENU;
      ctx = {};
    },
  };

  const deps = (): WatchDeps => ({
    api,
    send: async (o) => {
      sent.push(o);
      return sendResult(o);
    },
    store,
    now: clock.now,
    sleep: async (ms) => {
      await clock.sleep(ms);
      sleeps += 1;
      await sleepHook(sleeps);
    },
    actorPhone: actor,
    mainMenu: (l) => ({ kind: 'text', text: `MAIN_MENU_${l}` }),
  });
  const flow = () => new WatchFlow(deps(), { lang, state, ctx });

  return {
    clock,
    backend,
    api,
    calls,
    sent,
    state: () => state,
    ctx: () => ctx,
    lang: () => lang,
    start: async () => {
      await new WatchFlow(deps(), { lang, state, ctx: {} }).start();
    },
    say: async (text) => flow().handle({ text }),
    tap: async (id) => flow().handle({ text: '', interactiveId: id.startsWith('lw:') ? id : 'lw:' + id }),
    last: () => sent[sent.length - 1],
    lastText: () => textOf(sent[sent.length - 1]),
    allText: () => sent.map(textOf).join('\n---\n'),
    store: () => store,
    setSendResult: (fn) => {
      sendResult = fn;
    },
    onSleep: (fn) => {
      sleepHook = fn;
    },
  };
}

/** Connect PYP-0001 through the UI and land on the watch menu. */
export async function connectFirst(r: Rig, id = 'PYP-0001'): Promise<void> {
  await r.start();
  await r.say(id);
  await r.tap('yes');
}
