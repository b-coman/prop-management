/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
jest.mock('@/lib/logger', () => ({
  loggers: { campaign: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
}));

import { upsertThreadMessages, getBackfillQueue } from '../whatsappThreadService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { WhatsAppMessage } from '@/types';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb({ threads = {}, guests = {} }: { threads?: Record<string, any>; guests?: Record<string, any> } = {}) {
  const threadStore = new Map<string, any>(Object.entries(threads));

  const threadDoc = (id: string) => ({
    id,
    get: async () => ({ exists: threadStore.has(id), data: () => threadStore.get(id) }),
    set: async (data: any, opt?: { merge?: boolean }) => {
      const prev = threadStore.get(id) || {};
      threadStore.set(id, opt?.merge ? { ...prev, ...data } : data);
    },
  });

  const db = {
    collection: (name: string) => {
      if (name === 'whatsappThreads') {
        return {
          doc: (id: string) => threadDoc(id),
          get: async () => ({ docs: [...threadStore.entries()].map(([id, d]) => ({ id, data: () => d })) }),
        };
      }
      if (name === 'guests') {
        return { get: async () => ({ docs: Object.entries(guests).map(([id, d]) => ({ id, data: () => d })) }) };
      }
      return { doc: () => ({ get: async () => ({ exists: false }) }), get: async () => ({ docs: [] }) };
    },
  };
  return { db, threadStore };
}

const m = (ts: string, text: string, direction: 'in' | 'out' = 'out'): WhatsAppMessage => ({
  ts,
  direction,
  sender: direction === 'out' ? 'Bogdan Coman' : '+40711111111',
  text,
  type: 'text',
});

describe('upsertThreadMessages', () => {
  it('creates a new thread and records count + lastMessageTs + firstFetchedAt', async () => {
    const { db, threadStore } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);

    const res = await upsertThreadMessages({
      guestId: 'g1',
      phone: '+40711111111',
      messages: [m('2026-02-10T16:47:00', 'a'), m('2026-02-10T16:51:00', 'b', 'in')],
    });

    expect(res).toEqual({ added: 2, total: 2 });
    const doc = threadStore.get('g1');
    expect(doc.messageCount).toBe(2);
    expect(doc.lastMessageTs).toBe('2026-02-10T16:51:00');
    expect(doc.firstFetchedAt).toBe('ts');
    expect(doc.phone).toBe('+40711111111');
  });

  it('incremental top-up appends only new messages (dedupes the overlap)', async () => {
    const existing = [m('2026-02-10T16:47:00', 'a'), m('2026-02-10T16:51:00', 'b', 'in')];
    const { db, threadStore } = makeDb({
      threads: { g1: { guestId: 'g1', phone: '+40711111111', messages: existing, messageCount: 2, lastMessageTs: '2026-02-10T16:51:00' } },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await upsertThreadMessages({
      guestId: 'g1',
      phone: '+40711111111',
      messages: [m('2026-02-10T16:51:00', 'b', 'in'), m('2026-07-21T09:00:00', 'c', 'in')], // b is a dup
    });

    expect(res).toEqual({ added: 1, total: 3 });
    const doc = threadStore.get('g1');
    expect(doc.messageCount).toBe(3);
    expect(doc.lastMessageTs).toBe('2026-07-21T09:00:00');
    expect(doc.firstFetchedAt).toBeUndefined(); // not overwritten on update
  });
});

describe('getBackfillQueue', () => {
  const guests = {
    'g-ro-1': { firstName: 'Ana', lastName: 'Pop', language: 'ro', normalizedPhone: '+40711111111' },
    'g-en-1': { firstName: 'John', lastName: 'Doe', language: 'en', normalizedPhone: '+441234567' },
    'g-ro-nophone': { firstName: 'Bob', language: 'ro' },
    'g-ro-2': { firstName: 'Cristi', language: 'ro', normalizedPhone: '+40722222222' },
  };

  it('returns RO guests with a phone, annotated with thread status', async () => {
    const { db } = makeDb({
      guests,
      threads: { 'g-ro-2': { guestId: 'g-ro-2', lastMessageTs: '2026-05-01T10:00:00', messageCount: 12 } },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const q = await getBackfillQueue({ language: 'ro' });

    expect(q.map((i) => i.guestId)).toEqual(['g-ro-1', 'g-ro-2']); // EN + no-phone excluded, sorted by name
    const cristi = q.find((i) => i.guestId === 'g-ro-2')!;
    expect(cristi).toMatchObject({ hasThread: true, lastMessageTs: '2026-05-01T10:00:00', messageCount: 12 });
    const ana = q.find((i) => i.guestId === 'g-ro-1')!;
    expect(ana).toMatchObject({ hasThread: false, messageCount: 0, phone: '+40711111111' });
  });

  it('onlyMissing narrows to guests without a thread yet (first-pass backfill)', async () => {
    const { db } = makeDb({
      guests,
      threads: { 'g-ro-2': { guestId: 'g-ro-2', lastMessageTs: '2026-05-01T10:00:00', messageCount: 12 } },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const q = await getBackfillQueue({ language: 'ro', onlyMissing: true });
    expect(q.map((i) => i.guestId)).toEqual(['g-ro-1']);
  });
});
