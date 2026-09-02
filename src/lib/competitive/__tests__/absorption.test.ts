/** @jest-environment node */

/**
 * Absorption is the half of the engine that changes a decision, and almost every test here pins a
 * REFUSAL to over-claim. The failure mode is not a wrong number — it is a confident sentence about
 * demand built on a page that simply did not quote.
 */
import { readAbsorption, summariseField, type SellReading } from '../absorption';

const NOW = new Date('2026-09-30T12:00:00Z');
const r = (at: string, state: SellReading['state'], price: number | null = null): SellReading =>
  ({ at, state, price });

const read = (readings: SellReading[], multiUnit = false) =>
  readAbsorption({ readings, multiUnit, now: NOW });

describe('one reading is never an event', () => {
  it('calls a single not-sellable reading exactly that, and not "sold"', () => {
    const a = read([r('2026-09-20T10:00:00Z', 'not-sellable')]);
    expect(a.verdict).toBe('single-reading');
    expect(a.countsAsDemandSignal).toBe(false);
    expect(a.note).toMatch(/state, not an event/);
    expect(a.note).not.toMatch(/\bsold\b(?!.*only when)/);
  });

  it('calls a single priced reading on-sale, but not evidence of selling', () => {
    const a = read([r('2026-09-20T10:00:00Z', 'priced', 2000)]);
    expect(a.verdict).toBe('on-sale');
    expect(a.countsAsDemandSignal).toBe(false);
  });
});

describe('only a TRANSITION is evidence something sold', () => {
  it('reports priced -> not sellable with both dates and the last price', () => {
    const a = read([r('2026-09-10T10:00:00Z', 'priced', 2100), r('2026-09-25T10:00:00Z', 'not-sellable')]);
    expect(a.verdict).toBe('went-off-sale');
    expect(a.transition).toEqual({ lastPricedAt: '2026-09-10T10:00:00Z', lastPrice: 2100, goneBy: '2026-09-25T10:00:00Z' });
    expect(a.countsAsDemandSignal).toBe(true);
  });

  it('does NOT call it sold when it was never priced', () => {
    const a = read([r('2026-09-10T10:00:00Z', 'not-sellable'), r('2026-09-25T10:00:00Z', 'not-sellable')]);
    expect(a.verdict).toBe('never-priced');
    expect(a.countsAsDemandSignal).toBe(false);
    expect(a.note).toMatch(/Not evidence of selling/);
  });

  it('reads a return to sale as a release or cancellation, not a sale', () => {
    const a = read([r('2026-09-10T10:00:00Z', 'not-sellable'), r('2026-09-25T10:00:00Z', 'priced', 2200)]);
    expect(a.verdict).toBe('came-back');
    expect(a.countsAsDemandSignal).toBe(false);
  });
});

describe('a refusal or an error says nothing about demand', () => {
  it.each([['refused'], ['error']] as const)('ignores a run of %s readings', (state) => {
    const a = read([r('2026-09-10T10:00:00Z', state), r('2026-09-25T10:00:00Z', state)]);
    expect(a.verdict).toBe('no-signal');
    expect(a.note).toMatch(state === 'error' ? /about the probe, not about demand/ : /nothing usable survives the refusal/);
  });

  it('does not let a refusal masquerade as going off sale', () => {
    // Priced, then the party was refused. Not a sale — and, since the refusal is a standing policy
    // rather than a passing state, not "still on sale" either: the earlier price was never a price
    // this party could book, so there is nothing usable left.
    const a = read([r('2026-09-10T10:00:00Z', 'priced', 2000), r('2026-09-25T10:00:00Z', 'refused')]);
    expect(a.verdict).toBe('no-signal');
    expect(a.countsAsDemandSignal).toBe(false);
  });

  it('discards the prices read BEFORE a refusal, instead of calling their disappearance a sale', () => {
    // This is the AVA Chalet series, exactly (§29): two prices banked before the party-not-accepted
    // trap was found, then the refusal that exposed them, then an absence from the search. Read
    // naively that is "priced, then gone" — a sale. It is not: the property does not take a family
    // with a ten-year-old, so those 5,040s were never on sale to one. Two rows like this flipped a
    // window's headline from "the market is not selling" to "the market IS selling".
    const a = read([
      r('2026-09-01T20:37:00Z', 'priced', 5040),
      r('2026-09-01T21:18:00Z', 'priced', 5040),
      r('2026-09-01T22:12:00Z', 'refused'),
      r('2026-09-02T10:22:00Z', 'not-sellable'),
    ]);
    expect(a.verdict).not.toBe('went-off-sale');
    expect(a.transition).toBeUndefined();
    expect(a.countsAsDemandSignal).toBe(false);
    expect(a.note).toMatch(/never on sale to it/);
  });

  it('still reads a genuine sale when no refusal contaminates the series', () => {
    const a = read([r('2026-09-01T10:00:00Z', 'priced', 3000), r('2026-09-02T10:00:00Z', 'not-sellable')]);
    expect(a.verdict).toBe('went-off-sale');
    expect(a.countsAsDemandSignal).toBe(true);
  });
});

describe('a park sells out differently, and is never pooled with houses', () => {
  it('flags a multi-unit sell-out as a stronger but separate signal', () => {
    const a = read([r('2026-09-10T10:00:00Z', 'priced', 900), r('2026-09-25T10:00:00Z', 'not-sellable')], true);
    expect(a.verdict).toBe('went-off-sale');
    expect(a.multiUnit).toBe(true);
    expect(a.countsAsDemandSignal).toBe(false);   // real, but not tallied beside single houses
    expect(a.note).toMatch(/every unit went/);
  });
});

describe('stale readings are not a comparison', () => {
  it('ignores readings past the freshness window', () => {
    const a = readAbsorption({
      readings: [r('2026-01-01T10:00:00Z', 'priced', 2000), r('2026-01-05T10:00:00Z', 'not-sellable')],
      multiUnit: false, now: NOW,
    });
    expect(a.verdict).toBe('no-signal');
    expect(a.readings).toBe(0);
  });
});

describe('the field summary never states a percentage', () => {
  const row = (id: string, readings: SellReading[], multiUnit = false) =>
    ({ listingId: id, absorption: readAbsorption({ readings, multiUnit, now: NOW }) });

  it('says the market IS selling when houses went off sale', () => {
    const f = summariseField([
      row('a', [r('2026-09-10T10:00:00Z', 'priced', 2100), r('2026-09-25T10:00:00Z', 'not-sellable')]),
      row('b', [r('2026-09-10T10:00:00Z', 'priced', 2500), r('2026-09-25T10:00:00Z', 'priced', 2500)]),
    ]);
    expect(f.wentOffSale.map((w) => w.listingId)).toEqual(['a']);
    expect(f.stillOnSale).toBe(1);
    expect(f.summary).toMatch(/IS selling/);
    expect(f.summary).not.toMatch(/%/);
  });

  it('says the market is NOT selling when nothing moved — the "do not discount" case', () => {
    const f = summariseField([
      row('a', [r('2026-09-10T10:00:00Z', 'priced', 2100), r('2026-09-25T10:00:00Z', 'priced', 2100)]),
      row('b', [r('2026-09-10T10:00:00Z', 'priced', 2500), r('2026-09-25T10:00:00Z', 'priced', 2500)]),
    ]);
    expect(f.wentOffSale).toEqual([]);
    expect(f.summary).toMatch(/the market is not selling it either/);
  });

  it('reports parks apart from houses', () => {
    const f = summariseField([
      row('house', [r('2026-09-10T10:00:00Z', 'priced', 2100), r('2026-09-25T10:00:00Z', 'not-sellable')]),
      row('park', [r('2026-09-10T10:00:00Z', 'priced', 900), r('2026-09-25T10:00:00Z', 'not-sellable')], true),
    ]);
    expect(f.wentOffSale.map((w) => w.listingId)).toEqual(['house']);
    expect(f.parksSoldOut.map((w) => w.listingId)).toEqual(['park']);
    expect(f.summary).toMatch(/multi-unit propert/);
  });
});
