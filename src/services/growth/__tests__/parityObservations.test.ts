/**
 * `recordObservation` is the ONLY door into the parity store, and everything downstream — coverage,
 * staleness, drift, the eventual model — trusts whatever comes through it. It had no tests at all.
 *
 * These cover the door's job: refuse an under-provenanced write, refuse a write that would silently
 * orphan a cell, and preserve the figure exactly as captured.
 */
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: () => '__ts__' },
}));

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { recordObservation } from '../parityObservations';

const added: any[] = [];
beforeEach(() => {
  added.length = 0;
  (getAdminDb as jest.Mock).mockResolvedValue({
    collection: () => ({ add: async (doc: any) => { added.push(doc); return { id: 'obs1' }; } }),
  });
});

const base = {
  propertyId: 'prahova-mountain-chalet',
  cellId: 'prahova-mountain-chalet|2026-12-24|2026-12-29|3|airbnb',
  checkIn: '2026-12-24',
  checkOut: '2026-12-29',
  nights: 5,
  guests: 3,
  channel: 'airbnb',
  status: 'captured' as const,
  guestTotal: 4298,
  source: 'browser' as const,
  sessionState: 'logged in, Genius, RON',
};

describe('recordObservation — provenance is mandatory', () => {
  it('refuses a capture with no number', async () => {
    await expect(recordObservation({ ...base, guestTotal: undefined })).rejects.toThrow(/guestTotal/i);
  });

  it('refuses a non-captured status with no reason — a blank is not an outcome', async () => {
    await expect(
      recordObservation({ ...base, status: 'refused', guestTotal: undefined }),
    ).rejects.toThrow(/reason/i);
  });

  it('accepts a refusal that says why', async () => {
    await recordObservation({
      ...base, status: 'refused', guestTotal: undefined, reason: 'Airbnb min stay 4 nights',
    });
    expect(added[0].status).toBe('refused');
    expect(added[0].reason).toMatch(/min stay/);
  });

  it('refuses a capture with no session — the number means nothing without it', async () => {
    await expect(recordObservation({ ...base, sessionState: undefined })).rejects.toThrow(/session/i);
  });

  it('refuses a non-RON capture with no fx rate, and with no fx source', async () => {
    await expect(
      recordObservation({ ...base, rawCurrency: 'USD' } as any),
    ).rejects.toThrow(/fx/i);
    await expect(
      recordObservation({ ...base, rawCurrency: 'USD', fxRateToRon: 4.54 } as any),
    ).rejects.toThrow(/fx-source/i);
  });
});

describe('recordObservation — the channel must be one we know', () => {
  it('refuses an unknown channel rather than orphaning the cell', async () => {
    // The channel is embedded raw in the cellId, so a typo writes cleanly and creates a cell nothing
    // will ever match again. That is worse than a loud failure.
    await expect(recordObservation({ ...base, channel: 'airbnn' })).rejects.toThrow(/unknown channel/i);
    expect(added).toHaveLength(0);
  });

  it('accepts a known alias, because the vocabulary is forgiving about shape', async () => {
    await recordObservation({ ...base, channel: 'Booking.com' });
    expect(added).toHaveLength(1);
  });
});

describe('recordObservation — the figure survives the write', () => {
  it('keeps RON captures exact', async () => {
    await recordObservation({ ...base, guestTotal: 4298 });
    expect(added[0].guestTotal).toBe(4298);
    expect(added[0].rawCurrency).toBe('RON');
  });

  it('converts a foreign capture but keeps the raw figure re-derivable', async () => {
    await recordObservation({
      ...base, channel: 'vrbo', guestTotal: 1000, rawCurrency: 'USD',
      fxRateToRon: 4.54, fxRateSource: 'owner-stated 2026-08-07',
    } as any);
    expect(added[0].guestTotal).toBe(4540);
    expect(added[0].rawTotal).toBe(1000);
    expect(added[0].rawCurrency).toBe('USD');
    expect(added[0].fxRateToRon).toBe(4.54);
  });

  it('does not round a converted figure away to the whole leu', async () => {
    // 1718 USD at 4.5432 is 7805.22 lei. Rounding that to 7805 throws away real money on every
    // observation, and the drift this system measures is of that order on a short window.
    await recordObservation({
      ...base, channel: 'vrbo', guestTotal: 1718, rawCurrency: 'USD',
      fxRateToRon: 4.5432, fxRateSource: 'test',
    } as any);
    expect(added[0].guestTotal).toBeCloseTo(7805.22, 2);
  });

  it('records the list price too, so a promotion is measurable and not just flagged', async () => {
    await recordObservation({ ...base, guestTotal: 4298, listTotal: 5603, promoActive: true });
    expect(added[0].listTotal).toBe(5603);
    expect(added[0].promoActive).toBe(true);
  });

  it('defaults promoActive to false rather than leaving it undefined', async () => {
    await recordObservation(base);
    expect(added[0].promoActive).toBe(false);
  });
});
