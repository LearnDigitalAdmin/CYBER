/**
 * End-to-end rig for the shared UI: real webhook payloads go through the REAL webhook and handlers. Only the things
 * that need Firebase, Paystack or the network are replaced: the session store, message dedup, the Cloud API sender,
 * Firestore (rent), the MyChama data service and the two payment initiators. Not a test file.
 */
import './env';
import { Request, Response } from 'express';
import { Outbound } from '../../types/watch.types';
import { STATE } from '../../constants/states';
import { Session } from '../../types/session.types';
import { stampReply, toOutbounds, Reply } from '../../utils/ui';
import * as sessions from '../../services/session.service';
import * as dedup from '../../services/message-dedup.service';
import * as outbound from '../../services/outbound.service';
import * as waSender from '../../services/wa.sender';
import * as mychama from '../../services/mychama.service';
import * as mychamaPay from '../../services/mychama.payment.service';
import * as rentPay from '../../services/payment.service';
import { db } from '../../config/firebase.config';
import { handleIncomingMessage } from '../../webhooks/whatsapp-webhook';

export const PHONE = '254712345678';
export const TENANT_ID = '24681357';

/* eslint-disable @typescript-eslint/no-explicit-any */
const patch = (mod: unknown, name: string, fn: unknown): void => {
  (mod as any)[name] = fn;
};

/** FieldValue.delete() sentinels: setMc() uses them to clear a key. */
const isDelete = (v: any): boolean => v?.constructor?.name === 'DeleteTransform';
const strip = (o: Record<string, any>): Record<string, any> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => !isDelete(v)).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? strip(v) : v]));

export const member = {
  id: 'm1',
  memberId: 'm1',
  name: 'Wanjiru Kamau',
  phone: '0712345678',
  phoneNormalized: '+254712345678',
  role: 'member',
  isAdmin: false,
  idNumber: '',
  idLast4: '1234',
  nationalIdMasked: '****1234',
  joinDate: '2025-01-01',
  status: 'active',
  totalContributed: 5000,
  creditBalance: 0,
};
export const chamaDoc = {
  id: 'c1',
  name: 'Umoja Chama',
  plan: 'growth',
  contributionAmount: 1000,
  contributionCycle: 'monthly',
  status: 'active',
  settlementSplitCode: 'SPL_x',
  settlementSubaccountCode: 'ACCT_x',
  settlementSplitKeyVersion: 2,
};
export const contributions = Array.from({ length: 12 }, (_, i) => ({
  id: `ctr${i + 1}`,
  memberId: 'm1',
  period: `Period ${i + 1}`,
  periodKey: `2026-${String(i + 1).padStart(2, '0')}`,
  amount: 1000,
  paidAmount: 0,
  status: 'pending',
  method: 'mpesa',
  paidOn: null,
  ref: null,
}));
export const loanProduct = { id: 'p1', name: 'Emergency Loan', type: 'flat', rate: 5, maxAmount: 50000, maxTerm: 12, desc: '', active: true };

export class Rig {
  state: string = STATE.LANGUAGE_SELECTION;
  language: 'en' | 'sw' = 'en';
  context: Record<string, any> = {};
  /** Everything sent in answer to the most recent inbound message (ids stamped as the real sender would). */
  sent: Outbound[] = [];
  payments: any[] = [];
  chamaPayments: any[] = [];
  private n = 0;

  constructor(opts: { lang?: 'en' | 'sw'; state?: string } = {}) {
    this.language = opts.lang ?? 'en';
    this.state = opts.state ?? STATE.LANGUAGE_SELECTION;
    this.install();
  }

  private install(): void {
    const self = this;
    patch(sessions, 'createOrGetSession', async (phone: string): Promise<Session> => ({
      phone,
      language: self.language,
      currentState: self.state,
      context: JSON.parse(JSON.stringify(self.context)),
      lastActive: 0,
      createdAt: 0,
    }));
    patch(sessions, 'getSession', async (phone: string) => ({
      phone,
      language: self.language,
      currentState: self.state,
      context: JSON.parse(JSON.stringify(self.context)),
      lastActive: 0,
      createdAt: 0,
    }));
    patch(sessions, 'updateSessionState', async (_p: string, state: string, upd?: Record<string, any>) => {
      self.state = state;
      if (upd) self.context = strip({ ...self.context, ...upd });
    });
    patch(sessions, 'updateSessionContext', async (_p: string, upd: Record<string, any>) => {
      self.context = strip({ ...self.context, ...upd });
    });
    patch(sessions, 'clearSessionContext', async () => {
      self.context = {};
    });
    patch(sessions, 'updateSessionLanguage', async (_p: string, lang: 'en' | 'sw') => {
      self.language = lang;
    });
    patch(dedup, 'claimMessage', async () => true);
    patch(outbound, 'sendReply', async (_p: string, reply: Reply) => {
      self.sent.push(...stampReply(reply, self.state));
    });
    // Landlord Watch sends through the sender directly
    patch(waSender, 'sendOutbound', async (_to: string, o: Outbound) => {
      self.sent.push(o);
      return { ok: true };
    });

    // Rent: a tiny Firestore with one agent, one tenant, one unpaid invoice
    const asset = {
      id: 'asset1',
      doc: { name: 'Sunrise Apartments', paymentPhone: '0700000001' },
      tenants: [{ id: 't1', localId: Number(TENANT_ID), name: 'Jane Wanjiru' }],
      invoices: [
        {
          id: 'inv1',
          tenantId: Number(TENANT_ID),
          isPaid: false,
          billingMonth: '2026-10',
          rentAmount: 15000,
          waterCharges: 500,
          powerCharges: 0,
          otherCharges: 0,
          totalAmount: 15500,
          amountPaid: 0,
          arrears: 0,
          dueDate: '2026-10-05',
          pdfUrl: 'https://files.example/inv1.pdf',
        },
      ],
    };
    const query = (rows: any[], pred: (r: any) => boolean) => ({
      where: () => query(rows, pred),
      get: async () => {
        const hit = rows.filter(pred);
        return { empty: hit.length === 0, docs: hit.map((r) => ({ id: r.id, data: () => r })) };
      },
    });
    (db as any).collection = (name: string) => {
      if (name !== 'users') throw new Error(`unexpected collection ${name}`);
      return {
        get: async () => ({
          docs: [
            {
              id: asset.id,
              ref: {
                collection: (c: string) => ({
                  where: (_f: string, _op: string, ids: unknown[]) => query(c === 'tenants' ? asset.tenants : [], (r) => ids.includes(r.localId)),
                }),
              },
            },
          ],
        }),
        doc: () => ({
          get: async () => ({ exists: true, data: () => asset.doc }),
          collection: () => ({
            where: (_f: string, _op: string, ids: unknown[]) => query(asset.invoices, (r) => ids.includes(r.tenantId)),
          }),
        }),
      };
    };
    patch(rentPay, 'initiatePayment', async (p: any) => {
      self.payments.push(p);
      return { success: true, reference: 'RENT-REF-1', message: 'ok' };
    });

    // My Chama
    patch(mychama, 'getAuthLock', async () => null);
    patch(mychama, 'auditWhatsApp', async () => undefined);
    patch(mychama, 'findMembershipsByPhone', async () => [{ chamaId: 'c1', chamaName: 'Umoja Chama', member }]);
    patch(mychama, 'getMember', async () => member);
    patch(mychama, 'getChama', async () => chamaDoc);
    patch(mychama, 'recordAuthFailure', async () => ({ attempts: 1, remaining: 4, lockedUntil: 0 }));
    patch(mychama, 'clearAuthFailures', async () => undefined);
    patch(mychama, 'getOutstandingContributions', async () => contributions);
    patch(mychama, 'getContribution', async (_c: string, id: string) => contributions.find((c) => c.id === id) ?? null);
    patch(mychama, 'getContributionHistory', async () => []);
    patch(mychama, 'getLoanProducts', async () => [loanProduct]);
    patch(mychama, 'getMemberLoans', async () => []);
    patch(mychamaPay, 'getPendingIntents', async () => []);
    patch(mychamaPay, 'withinIntentRateLimit', async () => true);
    patch(mychamaPay, 'initiateMyChamaPayment', async (p: any) => {
      self.chamaPayments.push(p);
      return { success: true, reference: 'ABCDEFGHIJKLMNOP' };
    });
  }

  // ── driving ──────────────────────────────────────────────────────────

  private async deliver(msg: Record<string, unknown>): Promise<void> {
    this.sent = [];
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '1', phone_number_id: '1' },
                messages: [{ from: PHONE, id: `wamid.${++this.n}`, timestamp: String(Math.floor(Date.now() / 1000)), ...msg }],
              },
            },
          ],
        },
      ],
    };
    const req = { method: 'POST', body, get: () => 'application/json' } as unknown as Request;
    const res = { status: () => ({ send: () => undefined }) } as unknown as Response;
    await handleIncomingMessage(req, res);
  }

  say(text: string): Promise<void> {
    return this.deliver({ type: 'text', text: { body: text } });
  }

  /** Tap an interactive id exactly as WhatsApp would deliver it. */
  tapId(id: string, kind: 'button_reply' | 'list_reply' = 'list_reply'): Promise<void> {
    return this.deliver({ type: 'interactive', interactive: { type: kind, [kind]: { id } } });
  }

  /** Tap the button or row of the LAST interactive message whose title (or value) matches. */
  async tap(titleOrValue: string): Promise<void> {
    const o = this.lastInteractive();
    const items = o.kind === 'buttons' ? o.buttons : o.kind === 'list' ? o.rows : [];
    const hit = items.find((i) => i.title === titleOrValue || i.id.endsWith(`:${titleOrValue}`));
    if (!hit) throw new Error(`no "${titleOrValue}" on screen: ${items.map((i) => i.title).join(' | ')}`);
    await this.tapId(hit.id, o.kind === 'buttons' ? 'button_reply' : 'list_reply');
  }

  lastInteractive(): Extract<Outbound, { kind: 'buttons' | 'list' }> {
    const o = [...this.sent].reverse().find((x) => x.kind === 'buttons' || x.kind === 'list');
    if (!o) throw new Error('no interactive message was sent');
    return o as Extract<Outbound, { kind: 'buttons' | 'list' }>;
  }

  titles(): string[] {
    const o = this.lastInteractive();
    return o.kind === 'buttons' ? o.buttons.map((b) => b.title) : o.rows.map((r) => r.title);
  }

  body(): string {
    return this.lastInteractive().body;
  }

  allText(): string {
    return this.sent.map((o) => (o.kind === 'text' ? o.text : o.kind === 'document' ? o.caption ?? '' : o.body)).join('\n---\n');
  }

  kinds(): string {
    return toOutbounds(this.sent).map((o) => o.kind).join(',');
  }
}
