/**
 * Tests for the iCal sync's write path — which had none, despite two post-ship bugfixes on it
 * ("iCal import not writing blocked dates", "sync cleanup now finds availability docs missing
 * propertyId/month").
 *
 * The focus is the OTA observation seam, because its whole value is being trustworthy about WHEN a
 * reservation appeared. A first sighting recorded twice, or a re-sync counted as a new booking, would
 * report a working funnel that isn't one — which is exactly the error this store exists to prevent.
 */
import { syncFeedToAvailability } from '../ical-import';
import { recordOtaBlockObservations } from '@/services/otaBlockObservations';
import type { ICalFeed } from '@/types';

jest.mock('@/services/otaBlockObservations', () => ({
  recordOtaBlockObservations: jest.fn().mockResolvedValue(0),
}));
jest.mock('@/lib/logger', () => ({
  loggers: { icalSync: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } },
}));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__ts__', delete: () => '__delete__' },
  FieldPath: { documentId: () => '__docId__' },
}));

const mockRecord = recordOtaBlockObservations as jest.Mock;

const FEED: ICalFeed = {
  id: 'feed-booking',
  propertyId: 'prahova-mountain-chalet',
  name: 'Booking.com',
  url: 'https://example.test/cal.ics',
  enabled: true,
};

/**
 * A `db` stub over a single availability month. `docs` maps a month key to the stored document, so a
 * test can express "the 24th was already blocked by this feed" as data rather than as mock choreography.
 */
function makeDb(docs: Record<string, Record<string, unknown>> = {}) {
  const commit = jest.fn().mockResolvedValue(undefined);
  const batch = { set: jest.fn(), update: jest.fn(), commit };
  const db = {
    batch: jest.fn(() => batch),
    collection: jest.fn((name: string) => {
      if (name !== 'availability') throw new Error(`unexpected collection: ${name}`);
      return {
        where: () => ({
          where: () => ({
            get: async () => ({
              docs: Object.entries(docs).map(([month, data]) => ({
                id: `${FEED.propertyId}_${month}`,
                data: () => data,
              })),
            }),
          }),
        }),
        doc: (docId: string) => {
          const month = docId.slice(`${FEED.propertyId}_`.length);
          return {
            get: async () => ({ exists: !!docs[month], data: () => docs[month] }),
          };
        },
      };
    }),
  };
  return { db: db as never, batch };
}

/** One night, 24 Oct 2026. iCal end dates are exclusive. */
const oneNight = (uid = 'bkg-1') => [{
  uid,
  summary: 'CLOSED - Not available',
  startDate: new Date(Date.UTC(2026, 9, 24)),
  endDate: new Date(Date.UTC(2026, 9, 25)),
}];

/** Four nights, 24-27 Oct 2026 — one reservation, four days. */
const fourNights = (uid = 'bkg-4') => [{
  uid,
  summary: 'CLOSED - Not available',
  startDate: new Date(Date.UTC(2026, 9, 24)),
  endDate: new Date(Date.UTC(2026, 9, 28)),
}];

beforeEach(() => jest.clearAllMocks());

describe('OTA block observations', () => {
  it('records a first sighting when the night was not blocked before', async () => {
    const { db } = makeDb({ '2026-10': { propertyId: FEED.propertyId, month: '2026-10' } });
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.datesBlocked).toBe(1);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    const [rows] = mockRecord.mock.calls[0];
    expect(rows).toEqual([expect.objectContaining({
      propertyId: FEED.propertyId,
      date: '2026-10-24',
      feedId: 'feed-booking',
      feedName: 'Booking.com',
      event: 'appeared',
      uid: 'bkg-1',
    })]);
  });

  it('records NOTHING on a re-sync of a block it already knows about', async () => {
    // This is the one that matters. The cron runs every 15 minutes; if a steady state produced rows,
    // one reservation would look like ~96 bookings a day.
    const { db } = makeDb({
      '2026-10': { propertyId: FEED.propertyId, month: '2026-10', available: { 24: false }, externalBlocks: { 24: 'feed-booking' } },
    });
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.datesBlocked).toBe(0);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('does not record a first sighting when another feed already held the night', async () => {
    // The field is present, so this is a hand-off between feeds, not a new reservation.
    const { db } = makeDb({
      '2026-10': { propertyId: FEED.propertyId, month: '2026-10', available: { 24: false }, externalBlocks: { 24: 'feed-airbnb' } },
    });
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.datesBlocked).toBe(1); // the calendar is still corrected
    expect(mockRecord).not.toHaveBeenCalled(); // but it is not a new booking
  });

  it('gives every night of one reservation the same uid, so it folds back into one booking', async () => {
    const { db } = makeDb({ '2026-10': { propertyId: FEED.propertyId, month: '2026-10' } });
    await syncFeedToAvailability(db, FEED, fourNights('bkg-4'));

    const [rows] = mockRecord.mock.calls[0];
    expect(rows).toHaveLength(4);
    expect(rows.map((r: { date: string }) => r.date)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    expect(new Set(rows.map((r: { uid: string }) => r.uid))).toEqual(new Set(['bkg-4']));
  });

  it('shares one capturedAt across the whole run', async () => {
    const { db } = makeDb({ '2026-10': { propertyId: FEED.propertyId, month: '2026-10' } });
    await syncFeedToAvailability(db, FEED, fourNights());

    const [, capturedAt] = mockRecord.mock.calls[0];
    expect(typeof capturedAt).toBe('string');
    expect(capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records a release when a block disappears from the feed', async () => {
    const { db } = makeDb({
      '2026-10': { propertyId: FEED.propertyId, month: '2026-10', available: { 24: false }, externalBlocks: { 24: 'feed-booking' } },
    });
    const result = await syncFeedToAvailability(db, FEED, []);

    expect(result.datesReleased).toBe(1);
    const [rows] = mockRecord.mock.calls[0];
    expect(rows).toEqual([expect.objectContaining({ date: '2026-10-24', event: 'released' })]);
    expect(rows[0].uid).toBeUndefined(); // the event that created it is long gone
  });

  it('skips our own bookings and records no observation for them', async () => {
    // available:false with NO externalBlocks entry = our own booking. Must not be counted as an OTA one.
    const { db } = makeDb({
      '2026-10': { propertyId: FEED.propertyId, month: '2026-10', available: { 24: false } },
    });
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.skippedOurBookings).toBe(1);
    expect(result.datesBlocked).toBe(0);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('skips held dates', async () => {
    const { db } = makeDb({
      '2026-10': { propertyId: FEED.propertyId, month: '2026-10', holds: { 24: 'booking-abc' } },
    });
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.skippedOurBookings).toBe(1);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('skips our own exported events, so the export cannot re-enter as a booking', async () => {
    const { db } = makeDb({ '2026-10': { propertyId: FEED.propertyId, month: '2026-10' } });
    const result = await syncFeedToAvailability(db, FEED, oneNight('rentalspot-abc123'));

    expect(result.skippedOwnExport).toBe(1);
    expect(result.datesBlocked).toBe(0);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('does not call the store at all when nothing changed', async () => {
    const { db } = makeDb({
      '2026-10': { propertyId: FEED.propertyId, month: '2026-10', available: { 24: false }, externalBlocks: { 24: 'feed-booking' } },
    });
    await syncFeedToAvailability(db, FEED, oneNight());
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
