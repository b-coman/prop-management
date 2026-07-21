/** @jest-environment node */

// Mock the Admin SDK, the logger, and the Bucharest date helpers (imported by the
// route module but unused by the outbox ops) before importing the route.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
jest.mock('@/lib/logger', () => ({
  loggers: { adminBookings: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
}));
jest.mock('@/lib/dates/property-times', () => ({
  formatBucharestDate: jest.fn(() => '2026-07-21'),
  getBucharestDay: jest.fn(() => 21),
  getBucharestMonth: jest.fn(() => 7),
}));

import { GET } from '../route';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { NextRequest } from 'next/server';

const mockGetAdminDb = getAdminDb as jest.Mock;

/** Minimal NextRequest — the route only reads searchParams (+ headers, which the
 *  outbox path never reaches because the test property has no share token). */
function makeReq(params: Record<string, string>): NextRequest {
  const sp = new URLSearchParams(params);
  return {
    nextUrl: { searchParams: sp, origin: 'https://test.local' },
    headers: { get: () => null },
  } as unknown as NextRequest;
}

/** In-memory Firestore mock with a mutable `outbox`, serialized transactions, and
 *  capture of guests/messageLog updates. `properties` is always absent (so the
 *  share-token / calendar-url pre-step is a no-op for the outbox ops). */
function makeDb(seed: Record<string, Record<string, unknown>> = {}) {
  const outbox = new Map<string, Record<string, unknown>>(Object.entries(seed));
  const guestUpdates: { id: string; patch: Record<string, unknown> }[] = [];
  const messageLogUpdates: { id: string; patch: Record<string, unknown> }[] = [];

  const outboxDocRef = (id: string) => ({
    id,
    get: async () => ({ exists: outbox.has(id), data: () => outbox.get(id) }),
    update: async (patch: Record<string, unknown>) => { outbox.set(id, { ...(outbox.get(id) || {}), ...patch }); },
  });

  const outboxQuery = () => {
    const filters: Record<string, unknown> = {};
    const q: Record<string, (...a: unknown[]) => unknown> = {};
    q.where = (field: string, _op: string, val: unknown) => { filters[field] = val; return q; };
    q.limit = () => q;
    q.get = async () => {
      const docs = [...outbox.entries()]
        .filter(([, d]) => Object.entries(filters).every(([f, v]) => d[f] === v))
        .slice(0, 1)
        .map(([id, d]) => ({ id, ref: outboxDocRef(id), data: () => d }));
      return { empty: docs.length === 0, docs };
    };
    return q;
  };

  let txChain: Promise<unknown> = Promise.resolve();
  const txApi = {
    get: async (ref: { id: string }) => ({ exists: outbox.has(ref.id), data: () => outbox.get(ref.id) }),
    update: (ref: { id: string }, patch: Record<string, unknown>) => { outbox.set(ref.id, { ...(outbox.get(ref.id) || {}), ...patch }); },
  };
  const runTransaction = (fn: (tx: typeof txApi) => Promise<unknown>) => {
    const result = txChain.then(() => fn(txApi));
    txChain = result.then(() => undefined, () => undefined);
    return result;
  };

  const db = {
    runTransaction,
    collection: (name: string) => {
      if (name === 'outbox') { const q = outboxQuery(); return { where: q.where, doc: (id: string) => outboxDocRef(id) }; }
      if (name === 'properties') return { doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }) };
      if (name === 'messageLog') return { doc: (id: string) => ({ update: async (patch: Record<string, unknown>) => { messageLogUpdates.push({ id, patch }); } }) };
      if (name === 'guests') return { doc: (id: string) => ({ update: async (patch: Record<string, unknown>) => { guestUpdates.push({ id, patch }); } }) };
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  };
  return { db, outbox, guestUpdates, messageLogUpdates };
}

beforeEach(() => {
  process.env.AUTOMATION_TOKEN = 'secret';
});

describe('/api/automation — auth', () => {
  it('rejects a bad token with 401', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_next', propertyId: 'prahova', token: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('accepts the correct token', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_next', propertyId: 'prahova', token: 'secret' }));
    expect(res.status).toBe(200);
  });
});

describe('/api/automation — outbox_next', () => {
  it('claims the next queued message and returns a ready waUrl', async () => {
    const { db, outbox } = makeDb({
      o1: { propertyId: 'prahova', status: 'approved_pending_send', phone: '+40712345678', body: 'Salut Ana!' },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await GET(makeReq({ op: 'outbox_next', propertyId: 'prahova', token: 'secret' }));
    const json = await res.json();

    expect(json.status).toBe('ok');
    expect(json.id).toBe('o1');
    expect(json.phone).toBe('40712345678'); // digits only for wa.me
    expect(json.body).toBe('Salut Ana!');
    expect(json.waUrl).toBe('https://wa.me/40712345678?text=Salut%20Ana!');
    expect(outbox.get('o1')?.status).toBe('claimed'); // atomically claimed
  });

  it('returns none when the queue is empty', async () => {
    const { db } = makeDb({});
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_next', propertyId: 'prahova', token: 'secret' }));
    expect((await res.json()).status).toBe('none');
  });

  it('ignores messages for other properties', async () => {
    const { db } = makeDb({ o1: { propertyId: 'coltei', status: 'approved_pending_send', phone: '+40712345678', body: 'x' } });
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_next', propertyId: 'prahova', token: 'secret' }));
    expect((await res.json()).status).toBe('none');
  });

  it('does not return an already-claimed message', async () => {
    const { db } = makeDb({ o1: { propertyId: 'prahova', status: 'claimed', phone: '+40712345678', body: 'x' } });
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_next', propertyId: 'prahova', token: 'secret' }));
    expect((await res.json()).status).toBe('none');
  });
});

describe('/api/automation — outbox_sent', () => {
  it('marks sent, captures finalText, and closes the loop (messageLog + lastCampaignAt)', async () => {
    const { db, outbox, messageLogUpdates, guestUpdates } = makeDb({
      o1: { propertyId: 'prahova', status: 'claimed', guestId: 'g1', body: 'orig', messageLogId: 'ml1' },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await GET(makeReq({ op: 'outbox_sent', propertyId: 'prahova', id: 'o1', finalText: 'edited text', token: 'secret' }));
    expect((await res.json()).status).toBe('ok');

    expect(outbox.get('o1')?.status).toBe('sent');
    expect(outbox.get('o1')?.finalText).toBe('edited text');
    expect(messageLogUpdates).toEqual([{ id: 'ml1', patch: expect.objectContaining({ status: 'sent', finalText: 'edited text' }) }]);
    expect(guestUpdates).toEqual([{ id: 'g1', patch: expect.objectContaining({ lastCampaignAt: 'ts' }) }]);
  });

  it('falls back to the stored body when no finalText is given', async () => {
    const { db, outbox } = makeDb({ o1: { propertyId: 'prahova', status: 'claimed', guestId: 'g1', body: 'orig' } });
    mockGetAdminDb.mockResolvedValue(db);
    await GET(makeReq({ op: 'outbox_sent', propertyId: 'prahova', id: 'o1', token: 'secret' }));
    expect(outbox.get('o1')?.finalText).toBe('orig');
  });

  it('is idempotent when already sent (no double touch)', async () => {
    const { db, guestUpdates } = makeDb({ o1: { propertyId: 'prahova', status: 'sent', guestId: 'g1' } });
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_sent', propertyId: 'prahova', id: 'o1', token: 'secret' }));
    expect((await res.json()).status).toBe('ok');
    expect(guestUpdates).toHaveLength(0);
  });

  it('rejects a message belonging to a different property with 400', async () => {
    const { db } = makeDb({ o1: { propertyId: 'coltei', status: 'claimed', guestId: 'g1' } });
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_sent', propertyId: 'prahova', id: 'o1', token: 'secret' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is missing', async () => {
    const { db } = makeDb({});
    mockGetAdminDb.mockResolvedValue(db);
    const res = await GET(makeReq({ op: 'outbox_sent', propertyId: 'prahova', token: 'secret' }));
    expect(res.status).toBe(400);
  });
});
