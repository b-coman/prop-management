/** @jest-environment node */

// outboxService is the shared "mark sent" + "list for campaign" logic behind both
// the /api/automation Shortcut path and the admin Gate-2 send screen. These tests
// exercise it directly (the route test covers the same ops through the HTTP layer).

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
jest.mock('@/lib/logger', () => ({
  loggers: { campaign: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
}));
jest.mock('@/lib/utils', () => ({
  convertTimestampsToISOStrings: (o: unknown) => o, // identity — timestamps are already strings in seed
}));

import { markOutboxSent, fetchOutboxForCampaign } from '../outboxService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb(seed: Record<string, Record<string, unknown>> = {}) {
  const outbox = new Map<string, Record<string, unknown>>(Object.entries(seed));
  const guestUpdates: { id: string; patch: Record<string, unknown> }[] = [];
  const messageLogUpdates: { id: string; patch: Record<string, unknown> }[] = [];

  const outboxDocRef = (id: string) => ({
    id,
    get: async () => ({ exists: outbox.has(id), data: () => outbox.get(id) }),
    update: async (patch: Record<string, unknown>) => { outbox.set(id, { ...(outbox.get(id) || {}), ...patch }); },
  });

  const db = {
    collection: (name: string) => {
      if (name === 'outbox') {
        return {
          doc: (id: string) => outboxDocRef(id),
          where: (field: string, _op: string, val: unknown) => ({
            get: async () => ({
              docs: [...outbox.entries()]
                .filter(([, d]) => d[field] === val)
                .map(([id, d]) => ({ id, data: () => d })),
            }),
          }),
        };
      }
      if (name === 'messageLog') return { doc: (id: string) => ({ update: async (patch: Record<string, unknown>) => { messageLogUpdates.push({ id, patch }); } }) };
      if (name === 'guests') return { doc: (id: string) => ({ update: async (patch: Record<string, unknown>) => { guestUpdates.push({ id, patch }); } }) };
      return { doc: () => ({ get: async () => ({ exists: false }) }) };
    },
  };
  return { db, outbox, guestUpdates, messageLogUpdates };
}

describe('outboxService.markOutboxSent', () => {
  it('marks sent, records the final text, and closes the loop (messageLog + lastCampaignAt)', async () => {
    const { db, outbox, messageLogUpdates, guestUpdates } = makeDb({
      o1: { propertyId: 'prahova', status: 'approved_pending_send', guestId: 'g1', body: 'orig', messageLogId: 'ml1' },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await markOutboxSent('o1', { finalText: 'edited' });

    expect(res).toEqual({ success: true });
    expect(outbox.get('o1')?.status).toBe('sent');
    expect(outbox.get('o1')?.finalText).toBe('edited');
    expect(messageLogUpdates).toEqual([{ id: 'ml1', patch: expect.objectContaining({ status: 'sent', finalText: 'edited' }) }]);
    expect(guestUpdates).toEqual([{ id: 'g1', patch: expect.objectContaining({ lastCampaignAt: 'ts' }) }]);
  });

  it('falls back to the stored body when no finalText is given', async () => {
    const { db, outbox } = makeDb({ o1: { propertyId: 'prahova', status: 'approved_pending_send', guestId: 'g1', body: 'orig' } });
    mockGetAdminDb.mockResolvedValue(db);
    await markOutboxSent('o1');
    expect(outbox.get('o1')?.finalText).toBe('orig');
  });

  it('is idempotent when already sent (no guest re-touch)', async () => {
    const { db, guestUpdates } = makeDb({ o1: { propertyId: 'prahova', status: 'sent', guestId: 'g1' } });
    mockGetAdminDb.mockResolvedValue(db);
    const res = await markOutboxSent('o1', { finalText: 'x' });
    expect(res).toEqual({ success: true });
    expect(guestUpdates).toHaveLength(0);
  });

  it('returns not-found for a missing row', async () => {
    const { db } = makeDb({});
    mockGetAdminDb.mockResolvedValue(db);
    expect(await markOutboxSent('nope')).toEqual({ success: false, reason: 'not-found' });
  });

  it('rejects a row from another property when expectedPropertyId is set', async () => {
    const { db } = makeDb({ o1: { propertyId: 'coltei', status: 'approved_pending_send', guestId: 'g1' } });
    mockGetAdminDb.mockResolvedValue(db);
    expect(await markOutboxSent('o1', { expectedPropertyId: 'prahova' })).toEqual({ success: false, reason: 'wrong-property' });
  });
});

describe('outboxService.fetchOutboxForCampaign', () => {
  it('returns only the campaign rows, oldest first', async () => {
    const { db } = makeDb({
      o2: { campaignId: 'c1', createdAt: '2026-07-02', body: 'b' },
      o1: { campaignId: 'c1', createdAt: '2026-07-01', body: 'a' },
      x9: { campaignId: 'other', createdAt: '2026-07-03', body: 'z' },
    });
    mockGetAdminDb.mockResolvedValue(db);
    const rows = await fetchOutboxForCampaign('c1');
    expect(rows.map((r) => r.id)).toEqual(['o1', 'o2']);
  });
});
