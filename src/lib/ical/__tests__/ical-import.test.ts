/**
 * Tests for the iCal sync's write path, which had none despite two post-ship bugfixes on it
 * ("iCal import not writing blocked dates", "sync cleanup now finds availability docs missing
 * propertyId/month").
 *
 * What matters here is conflict resolution: this is the code that decides whether an OTA feed may
 * overwrite a date we have already sold. Getting that wrong is a double booking, which is the most
 * expensive failure this repo can produce.
 */
import { syncFeedToAvailability } from '../ical-import';
import type { ICalFeed } from '@/types';

jest.mock('@/lib/logger', () => ({
  loggers: { icalSync: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } },
}));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__ts__', delete: () => '__delete__' },
  FieldPath: { documentId: () => '__docId__' },
}));

const FEED: ICalFeed = {
  id: 'feed-booking',
  propertyId: 'prahova-mountain-chalet',
  name: 'Booking.com',
  url: 'https://example.test/cal.ics',
  enabled: true,
};

/**
 * A `db` stub over a single availability month, so a test can express "the 24th was already blocked
 * by this feed" as data rather than as mock choreography. `batch.update` calls are inspectable, which
 * is how the write assertions below work.
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
          return { get: async () => ({ exists: !!docs[month], data: () => docs[month] }) };
        },
      };
    }),
  };
  return { db: db as never, batch };
}

/** One night, 24 Oct 2026. iCal end dates are exclusive. */
const oneNight = (uid = 'bkg-1') => [{
  uid,
  summary: 'Reserved',
  startDate: new Date(Date.UTC(2026, 9, 24)),
  endDate: new Date(Date.UTC(2026, 9, 25)),
}];

/** Four nights, 24-27 Oct 2026. */
const fourNights = () => [{
  uid: 'bkg-4',
  summary: 'Reserved',
  startDate: new Date(Date.UTC(2026, 9, 24)),
  endDate: new Date(Date.UTC(2026, 9, 28)),
}];

const month = (extra: Record<string, unknown> = {}) => ({
  '2026-10': { propertyId: FEED.propertyId, month: '2026-10', ...extra },
});

beforeEach(() => jest.clearAllMocks());

describe('syncFeedToAvailability', () => {
  it('blocks a night the feed reports and we do not yet hold', async () => {
    const { db, batch } = makeDb(month());
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.datesBlocked).toBe(1);
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      'available.24': false,
      'externalBlocks.24': 'feed-booking',
    }));
  });

  it('expands a multi-night event to one entry per night, checkout excluded', async () => {
    const { db } = makeDb(month());
    const result = await syncFeedToAvailability(db, FEED, fourNights());
    expect(result.datesBlocked).toBe(4);   // 24, 25, 26, 27 — not the 28th
  });

  it('writes nothing when the state already matches', async () => {
    // The cron runs every 15 minutes; a steady state must be a no-op.
    const { db, batch } = makeDb(month({ available: { 24: false }, externalBlocks: { 24: 'feed-booking' } }));
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.datesBlocked).toBe(0);
    expect(batch.update).not.toHaveBeenCalled();
  });

  it('NEVER overwrites a date we have sold ourselves', async () => {
    // available:false with no externalBlocks entry is our own booking. Losing this check is a
    // double booking, which is why it is the most important assertion in the file.
    const { db, batch } = makeDb(month({ available: { 24: false } }));
    const result = await syncFeedToAvailability(db, FEED, oneNight());

    expect(result.skippedOurBookings).toBe(1);
    expect(result.datesBlocked).toBe(0);
    expect(batch.update).not.toHaveBeenCalled();
  });

  it('never overwrites a held date', async () => {
    const { db } = makeDb(month({ holds: { 24: 'booking-abc' } }));
    const result = await syncFeedToAvailability(db, FEED, oneNight());
    expect(result.skippedOurBookings).toBe(1);
    expect(result.datesBlocked).toBe(0);
  });

  it('ignores our own exported events, so the export cannot re-enter as a block', async () => {
    const { db } = makeDb(month());
    const result = await syncFeedToAvailability(db, FEED, oneNight('rentalspot-abc123'));
    expect(result.skippedOwnExport).toBe(1);
    expect(result.datesBlocked).toBe(0);
  });

  it('releases a block that has disappeared from the feed', async () => {
    const { db, batch } = makeDb(month({ available: { 24: false }, externalBlocks: { 24: 'feed-booking' } }));
    const result = await syncFeedToAvailability(db, FEED, []);

    expect(result.datesReleased).toBe(1);
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      'available.24': true,
      'externalBlocks.24': '__delete__',
    }));
  });

  it('takes over a night another feed was holding', async () => {
    const { db } = makeDb(month({ available: { 24: false }, externalBlocks: { 24: 'feed-airbnb' } }));
    const result = await syncFeedToAvailability(db, FEED, oneNight());
    expect(result.datesBlocked).toBe(1);
  });

  it('always stamps propertyId and month, for docs other code paths created without them', async () => {
    // The reason for one of the two post-ship bugfixes: cleanup could not find such docs.
    const { db, batch } = makeDb(month());
    await syncFeedToAvailability(db, FEED, oneNight());
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      propertyId: FEED.propertyId,
      month: '2026-10',
    }));
  });
});
