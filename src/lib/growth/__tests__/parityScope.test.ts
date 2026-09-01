/** @jest-environment node */

/**
 * The seam that keeps a competitor's price from becoming the owner's.
 *
 * Two independent mechanisms, tested here because neither fails loudly on its own:
 *
 *  1. `cellId` carries the subject, so a competitor row cannot occupy a self cell's key. Without it
 *     `latestByCell` — which keys on the id and takes the newest — hands a competitor's price to
 *     `apply-band-pricing.ts`, which writes live prices.
 *  2. `requireScope` refuses an unscoped read AT RUNTIME. A required TypeScript parameter is not
 *     enough: `tsconfig.json` excludes `scripts/`, where twelve of the thirteen readers live.
 */
import {
  cellId, subjectOf, matchesScope, requireScope, DEFAULT_SUBJECT,
  type ObservationSubject, type ObservationScope,
} from '../parityWorklist';

const P = 'prahova-mountain-chalet';

describe('cellId carries the subject', () => {
  it('leaves a SELF id byte-identical to the pre-competitor format', () => {
    // This exact string shape is in 790 live documents. Changing it orphans every one of them.
    const expected = `${P}|2026-10-24|2026-10-28|3|airbnb`;
    expect(cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb')).toBe(expected);
    expect(cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb', { kind: 'self' })).toBe(expected);
    expect(cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb', DEFAULT_SUBJECT)).toBe(expected);
  });

  it('appends a distinct segment for a competitor, so the two can never collide', () => {
    const self = cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb');
    const comp = cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb', { kind: 'competitor', listingId: 'vila-luna' });
    expect(comp).toBe(`${P}|2026-10-24|2026-10-28|3|airbnb|comp:vila-luna`);
    expect(comp).not.toBe(self);
  });

  it('gives two different competitors different ids on the same window', () => {
    const a = cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb', { kind: 'competitor', listingId: 'vila-luna' });
    const b = cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb', { kind: 'competitor', listingId: 'ava-chalet' });
    expect(a).not.toBe(b);
  });

  it('is stable across calls, so runs months apart are diffable', () => {
    const s: ObservationSubject = { kind: 'competitor', listingId: 'the-cliff-village' };
    expect(cellId(P, '2026-12-24', '2026-12-29', 6, 'booking.com', s))
      .toBe(cellId(P, '2026-12-24', '2026-12-29', 6, 'booking.com', s));
  });

  it('refuses a listingId containing the field separator', () => {
    expect(() => cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb', { kind: 'competitor', listingId: 'a|b' }))
      .toThrow(/free of "\|"/);
  });

  it('refuses an empty listingId rather than emitting a bare "comp:" suffix', () => {
    expect(() => cellId(P, '2026-10-24', '2026-10-28', 3, 'airbnb', { kind: 'competitor', listingId: '' }))
      .toThrow(/non-empty/);
  });
});

describe('subjectOf treats a missing subject as self', () => {
  // 199 of the first 790 live rows predate the field. Reading them as "unknown" would drop a quarter
  // of the history; reading them as competitor would be catastrophic. They are all the owner's own.
  it('defaults an absent subject to self', () => {
    expect(subjectOf({})).toEqual({ kind: 'self' });
    expect(subjectOf({ subject: undefined })).toEqual({ kind: 'self' });
  });

  it('passes through a stated subject unchanged', () => {
    expect(subjectOf({ subject: { kind: 'competitor', listingId: 'vila-luna' } }))
      .toEqual({ kind: 'competitor', listingId: 'vila-luna' });
  });
});

describe('matchesScope', () => {
  const self = { subject: { kind: 'self' } as ObservationSubject };
  const legacy = {}; // pre-`subject` row
  const luna = { subject: { kind: 'competitor', listingId: 'vila-luna' } as ObservationSubject };
  const ava = { subject: { kind: 'competitor', listingId: 'ava-chalet' } as ObservationSubject };

  it('self scope takes stated-self AND legacy rows, and no competitor', () => {
    expect(matchesScope(self, { kind: 'self' })).toBe(true);
    expect(matchesScope(legacy, { kind: 'self' })).toBe(true);
    expect(matchesScope(luna, { kind: 'self' })).toBe(false);
  });

  it('competitor scope without a listingId takes the whole comparable set, never self', () => {
    expect(matchesScope(luna, { kind: 'competitor' })).toBe(true);
    expect(matchesScope(ava, { kind: 'competitor' })).toBe(true);
    expect(matchesScope(self, { kind: 'competitor' })).toBe(false);
    expect(matchesScope(legacy, { kind: 'competitor' })).toBe(false);
  });

  it('competitor scope with a listingId takes only that listing', () => {
    expect(matchesScope(luna, { kind: 'competitor', listingId: 'vila-luna' })).toBe(true);
    expect(matchesScope(ava, { kind: 'competitor', listingId: 'vila-luna' })).toBe(false);
  });

  it('all takes everything, including legacy rows', () => {
    for (const r of [self, legacy, luna, ava]) expect(matchesScope(r, { kind: 'all' })).toBe(true);
  });
});

describe('requireScope is a RUNTIME guard, because scripts/ is not typechecked', () => {
  it.each([undefined, null, {}, 'self', { kind: 'everything' }, 0])(
    'throws on %p', (bad) => {
      expect(() => requireScope(bad as unknown, 'latestByCell')).toThrow(/requires an explicit ObservationScope/);
    },
  );

  it('names the calling function so the fix is obvious from the stack', () => {
    expect(() => requireScope(undefined, 'loadObservations')).toThrow(/loadObservations\(\)/);
  });

  it('returns valid scopes untouched', () => {
    const scopes: ObservationScope[] = [
      { kind: 'self' }, { kind: 'all' },
      { kind: 'competitor' }, { kind: 'competitor', listingId: 'vila-luna' },
    ];
    for (const s of scopes) expect(requireScope(s, 'x')).toBe(s);
  });
});
