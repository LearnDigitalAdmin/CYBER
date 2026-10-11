/**
 * TEST-ONLY storage switch for the operations-backend suites (requests, docs, account, topdesk, payouts).
 *  - FIRESTORE_EMULATOR_HOST set  -> the suites run against the REAL Firestore emulator (`npm run desk:test:emu`).
 *  - otherwise                    -> they run against the in-memory double from ledger/fakefs.test.ts, extended here with the
 *    few Admin SDK features these areas use (getAll, array-contains, batch update, count/sum, value cursors).
 * The in-memory double is NOT a substitute for the emulator run. It contains no tests itself.
 */
import { emulatorEnabled, clearFirestore } from "../testing/emulator.js";
import { FakeFirestore, FakeQuery, installFakeFirestore, type FakeDoc } from "../ledger/fakefs.test.js";

type Data = Record<string, unknown>;
type Internals = { filters: { f: string; op: string; v: unknown }[]; order: { f: string; dir: string }[]; lim?: number; after?: unknown; colPath: string; fs: FakeFirestore };

let installed: FakeFirestore | undefined;

const cmp = (a: unknown, b: unknown): number => ((a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0);

function rowsOf(q: Internals): { id: string; path: string; data: Data }[] {
  let rows = q.fs.all(q.colPath).filter((r) => q.filters.every(({ f, op, v }) => {
    const x = r.data[f];
    switch (op) {
      case "==": return x !== undefined && cmp(x, v) === 0;
      case "<": return x !== undefined && cmp(x, v) < 0;
      case "<=": return x !== undefined && cmp(x, v) <= 0;
      case ">": return x !== undefined && cmp(x, v) > 0;
      case ">=": return x !== undefined && cmp(x, v) >= 0;
      case "in": return (v as unknown[]).includes(x);
      case "array-contains": return Array.isArray(x) && x.includes(v);
      default: throw new Error(`memstore: unsupported operator ${op}`);
    }
  }));
  const keys = q.order.length ? q.order : [{ f: "__name__", dir: "asc" }];
  const val = (r: { id: string; data: Data }, f: string) => (f === "__name__" ? r.id : r.data[f]);
  rows.sort((a, b) => { for (const { f, dir } of keys) { const c = cmp(val(a, f), val(b, f)); if (c) return dir === "desc" ? -c : c; } return cmp(a.id, b.id); });
  if (q.after !== undefined) {
    if (typeof q.after === "number") { const k = keys[0]; rows = rows.filter((r) => (k.dir === "desc" ? (val(r, k.f) as number) < (q.after as number) : (val(r, k.f) as number) > (q.after as number))); }
    else { const i = rows.findIndex((r) => r.id === q.after); rows = rows.slice(i + 1); }
  }
  if (q.lim !== undefined) rows = rows.slice(0, q.lim);
  return rows;
}

function extend(): void {
  const proto = FakeQuery.prototype as unknown as Record<string, unknown>;
  const fsProto = FakeFirestore.prototype as unknown as Record<string, unknown>;
  proto.startAfter = function (this: Internals, s: { id: string } | number) {
    const q = new FakeQuery(this.fs, this.colPath, this.filters as never, this.order as never, this.lim);
    (q as unknown as Internals).after = typeof s === "number" ? s : s.id;
    return q;
  };
  const origLimit = proto.limit as (n: number) => FakeQuery;
  proto.limit = function (this: Internals, n: number) {
    const q = origLimit.call(this, n);
    (q as unknown as Internals).after = this.after;
    return q;
  };
  const origWhere = proto.where as (f: string, op: string, v: unknown) => FakeQuery;
  proto.where = function (this: Internals, f: string, op: string, v: unknown) { const q = origWhere.call(this, f, op, v); (q as unknown as Internals).after = this.after; return q; };
  const origOrder = proto.orderBy as (f: string, d?: string) => FakeQuery;
  proto.orderBy = function (this: Internals, f: string, d?: string) { const q = origOrder.call(this, f, d); (q as unknown as Internals).after = this.after; return q; };
  proto.get = async function (this: Internals) {
    const rows = rowsOf(this);
    const docs = rows.map((r) => new (installed!.doc(r.path).constructor as new (fs: FakeFirestore, p: string) => FakeDoc)(this.fs, r.path));
    const snaps = await Promise.all(docs.map((d) => d.get()));
    return { docs: snaps, empty: snaps.length === 0, size: snaps.length };
  };
  proto.count = function (this: Internals) {
    return { get: async () => ({ data: () => ({ count: rowsOf({ ...this, lim: undefined }).length }) }) };
  };
  proto.aggregate = function (this: Internals, spec: Record<string, { field?: string; aggregateType?: string }>) {
    return {
      get: async () => {
        const rows = rowsOf({ ...this, lim: undefined });
        const out: Data = {};
        for (const [k, a] of Object.entries(spec)) out[k] = rows.reduce((s, r) => s + (Number(r.data[(a as { _field?: string })._field ?? (a as { field?: string }).field ?? ""]) || 0), 0);
        return { data: () => out };
      },
    };
  };
  fsProto.getAll = function (this: FakeFirestore, ...refs: FakeDoc[]) { return Promise.all(refs.map((r) => r.get())); };
  fsProto.batch = function (this: FakeFirestore) {
    const ops: (() => void)[] = [];
    return {
      update: (r: FakeDoc, d: Data) => { ops.push(() => r.applyUpdate(d)); },
      set: (r: FakeDoc, d: Data) => { ops.push(() => r.applySet(d)); },
      delete: (r: FakeDoc) => { ops.push(() => { this.store.delete(r.path); }); },
      commit: async () => { ops.forEach((o) => o()); },
    };
  };
}

/** Call once at module load of a suite. Returns the reset to run before each test. */
export function useStore(): { reset(): Promise<void>; inMemory: boolean } {
  if (emulatorEnabled) return { reset: clearFirestore, inMemory: false };
  if (!installed) { installed = new FakeFirestore(); installFakeFirestore(installed); extend(); }
  return { reset: async () => { installed!.clear(); }, inMemory: true };
}
