/** @jest-environment node */

/**
 * The board's job is to stop a true number producing a wrong decision. Most of these tests are the
 * real December and October readings, because those are the cases that exposed the failure.
 */
import {
  buildBoard, summariseBoard, LEVEL_BAND_PCT, SCARCITY, MIN_QUOTES, type BoardRowInput,
} from '../board';

const row = (over: Partial<BoardRowInput> = {}): BoardRowInput => ({
  key: 'w', checkIn: '2026-10-24', checkOut: '2026-10-28', nights: 4, partyLabel: '2a+1c',
  channel: 'booking.com', channelLabel: 'Booking.com',
  ourPrice: 2719, ourDirect: 2283,
  fieldMedian: 3202, fieldMin: 1706, fieldMax: 5320,
  quoted: 8, eligible: 14, nothingLeft: 6, cantHost: 1, unread: 0,
  oldestAgeDays: 0, soldNights: 0, movedSinceLastReading: 0,
  ...over,
});

/** 30 Dec – 2 Jan, exactly as captured: 7,243 against three leftovers, ten with nothing left. */
const NEW_YEAR = row({
  key: 'ny', checkIn: '2026-12-30', checkOut: '2027-01-02', nights: 3,
  ourPrice: 7243, ourDirect: 5842,
  fieldMedian: 3341, fieldMin: 2796, fieldMax: 3856,
  quoted: 3, eligible: 13, nothingLeft: 10, cantHost: 2,
});

describe('the case that produced this module', () => {
  it('does NOT call New Year overpriced just because we are dearest', () => {
    // The ladder screen said "dearest of 4" and that reads as "cut your price". Ten of thirteen
    // comparables had nothing left; the three still quoting are the remainder nobody booked.
    const [r] = buildBoard([NEW_YEAR]);
    expect(r.position).toBe('dear');
    expect(r.scarcity).toBe('tight');
    expect(r.attention).toBe('ok');
    expect(r.label).toBe('Cleared above you');
    expect(r.why).toMatch(/not evidence you are overpriced/);
    expect(r.aboveAll).toBe(true);
  });

  it('DOES raise the alarm when we are dear and buyers still have choice', () => {
    const r = buildBoard([{ ...NEW_YEAR, quoted: 12, nothingLeft: 1 }])[0];
    expect(r.scarcity).toBe('open');
    expect(r.attention).toBe('watch');
    expect(r.label).toBe('Exposed');
    expect(r.why).toMatch(/every one of them is cheaper than you/);
  });

  it('treats CHEAP in a cleared market as the loudest signal on the board', () => {
    // The inversion the old screen got backwards: it would have shown this as "good news, cheapest".
    const r = buildBoard([{ ...NEW_YEAR, ourPrice: 2000 }])[0];
    expect(r.position).toBe('cheap');
    expect(r.attention).toBe('act');
    expect(r.label).toBe('Left money');
    expect(r.why).toMatch(/in demand, and you are priced as though it were not/);
  });

  it('calls cheap-and-quiet a demand problem, not a price one', () => {
    const r = buildBoard([{ ...NEW_YEAR, ourPrice: 2000, quoted: 12, nothingLeft: 1 }])[0];
    expect(r.attention).toBe('ok');
    expect(r.why).toMatch(/demand problem, not a price one/);
  });
});

describe('what it refuses to say', () => {
  it('ranks nothing below the quote floor and says so', () => {
    const r = buildBoard([row({ quoted: MIN_QUOTES - 1, nothingLeft: 1 })])[0];
    expect(r.attention).toBe('thin');
    expect(r.position).toBe('unknown');
    expect(r.label).toBe('Too thin');
  });

  it('never suggests a price, anywhere in the output', () => {
    const board = buildBoard([NEW_YEAR, row(), row({ ourPrice: 900 })]);
    for (const r of board) {
      expect(r.why).not.toMatch(/\b(raise|lower|cut|drop|increase|set) (your |the )?price/i);
      expect(r).not.toHaveProperty('suggestedPrice');
    }
  });

  it('keeps unread comparables OUT of the on-sale share rather than guessing them', () => {
    // 4 quoted, 4 with nothing left, 5 never read: the share is 4/8, not 4/13.
    const r = buildBoard([row({ quoted: 4, nothingLeft: 4, unread: 5, eligible: 13 })])[0];
    expect(r.onSaleShare).toBeCloseTo(0.5);
    expect(r.unread).toBe(5);
  });

  it('says nothing about a window already booked out', () => {
    const r = buildBoard([{ ...NEW_YEAR, ourPrice: 2000, soldNights: 3 }])[0];
    expect(r.fullySold).toBe(true);
    expect(r.attention).toBe('ok');       // even though cheap + tight would otherwise be 'act'
    expect(r.label).toBe('Sold');
    expect(r.atStake).toBe(0);
  });
});

describe('the label never contradicts the number beside it', () => {
  // The October Airbnb row rendered "-48%" next to the words "In line", because every mixed-scarcity
  // row fell through to the same label. A screen that argues with its own figure loses the reader.
  it('does not call a 48% gap "In line" just because scarcity is in the middle', () => {
    const r = buildBoard([row({ ourPrice: 2369, fieldMedian: 4594, fieldMin: 2426, fieldMax: 5644,
                                quoted: 5, nothingLeft: 2 })])[0];
    expect(r.scarcity).toBe('mixed');
    expect(r.position).toBe('cheap');
    expect(r.label).toBe('Below the field');
    expect(r.label).not.toBe('In line');
  });

  it('labels a dear price in a middling market as above the field, not level', () => {
    const r = buildBoard([row({ ourPrice: 6000, fieldMedian: 3000, quoted: 5, nothingLeft: 2 })])[0];
    expect(r.label).toBe('Above the field');
    expect(r.attention).toBe('ok');     // mixed is not exposed — that needs an open field
  });

  it('keeps "In line" for prices that actually are', () => {
    const r = buildBoard([row({ ourPrice: 3050, fieldMedian: 3000, quoted: 5, nothingLeft: 2 })])[0];
    expect(r.label).toBe('In line');
  });

  it('says so plainly when we have no price of our own to place', () => {
    const r = buildBoard([row({ ourPrice: null })])[0];
    expect(r.attention).toBe('thin');
    expect(r.label).toBe('No price of ours');
  });

  it('every label agrees in DIRECTION with the gap it is shown beside', () => {
    const cases = [500, 1500, 2900, 3000, 3100, 5000, 12000];
    for (const p of cases) {
      for (const [quoted, gone] of [[3, 10], [5, 2], [9, 1]] as const) {
        const r = buildBoard([row({ ourPrice: p, fieldMedian: 3000, fieldMax: 4000, quoted, nothingLeft: gone })])[0];
        if (r.gapPct === null) continue;
        if (r.gapPct > LEVEL_BAND_PCT) expect(r.label).not.toMatch(/In line|Below the field/);
        if (r.gapPct < -LEVEL_BAND_PCT) expect(r.label).not.toMatch(/In line|Above the field|Cleared above you/);
      }
    }
  });
});

describe('the thresholds', () => {
  it('treats a gap inside the level band as level, either way', () => {
    const median = 3000;
    for (const p of [median * 1.09, median * 0.91, median]) {
      expect(buildBoard([row({ ourPrice: p, fieldMedian: median })])[0].position).toBe('level');
    }
    expect(buildBoard([row({ ourPrice: median * 1.2, fieldMedian: median })])[0].position).toBe('dear');
    expect(buildBoard([row({ ourPrice: median * 0.8, fieldMedian: median })])[0].position).toBe('cheap');
    expect(LEVEL_BAND_PCT).toBe(10);
  });

  it('splits scarcity on the share of the field still asked-and-quoting', () => {
    const at = (quoted: number, nothingLeft: number) =>
      buildBoard([row({ quoted, nothingLeft })])[0].scarcity;
    expect(at(3, 10)).toBe('tight');              // 0.23
    expect(at(6, 6)).toBe('mixed');               // 0.50
    expect(at(9, 1)).toBe('open');                // 0.90
    expect(SCARCITY.tight).toBeLessThan(SCARCITY.open);
  });

  it('reports the gap as a percentage, which is what compares across windows', () => {
    const r = buildBoard([NEW_YEAR])[0];
    expect(Math.round(r.gapPct!)).toBe(117);      // 7,243 against a median of 3,341
  });
});

describe('ordering and money', () => {
  it('puts what needs acting on first, then what is worth most', () => {
    const board = buildBoard([
      row({ key: 'fine', ourPrice: 3200, ourDirect: 9000 }),                       // level, big money
      { ...NEW_YEAR, key: 'exposed', quoted: 12, nothingLeft: 1 },                 // watch
      { ...NEW_YEAR, key: 'money', ourPrice: 2000, ourDirect: 1000 },              // act, small money
      { ...NEW_YEAR, key: 'bigmoney', ourPrice: 2000, ourDirect: 9000 },           // act, big money
    ]);
    expect(board.map((r) => r.key)).toEqual(['bigmoney', 'money', 'exposed', 'fine']);
  });

  it('pro-rates what is at stake by the nights still unsold', () => {
    const r = buildBoard([row({ nights: 4, ourDirect: 2000, soldNights: 1 })])[0];
    expect(r.atStake).toBe(1500);
  });
});

describe('the summary', () => {
  it('says plainly when nothing needs attention', () => {
    const s = summariseBoard(buildBoard([row(), row({ key: 'b' })]));
    expect(s.headline).toMatch(/Nothing is out of line/);
    expect(s.act + s.watch).toBe(0);
  });

  it('counts the two kinds of problem separately, and never as a percentage', () => {
    const s = summariseBoard(buildBoard([
      { ...NEW_YEAR, key: 'a', ourPrice: 2000 },
      { ...NEW_YEAR, key: 'b', quoted: 12, nothingLeft: 1 },
    ]));
    expect(s.act).toBe(1);
    expect(s.watch).toBe(1);
    expect(s.headline).toMatch(/cheap in a market that has largely sold/);
    expect(s.headline).toMatch(/dear and buyers still have choice/);
    expect(s.headline).not.toMatch(/%/);
  });
});
