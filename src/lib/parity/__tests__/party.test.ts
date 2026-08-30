/**
 * The party shape is configuration, not something to derive. These tests exist because deriving it
 * put 38 wrong prices in the store: "6 guests" became 6 adults, a party this property cannot host.
 */
import { partiesFor, partyForGuests, buildCaptureUrl, partySize, partyLabel, DEFAULT_PARTIES } from '../party';

const AIRBNB = 'https://www.airbnb.com/rooms/43265214';
const BOOKING = 'https://www.booking.com/hotel/ro/mountain-family-chalet-on-prahova-valley.en-gb.html';

describe('the mix is read, not guessed', () => {
  it('uses compareParties when configured', () => {
    const m = partiesFor({ compareParties: [{ adults: 2, children: 1 }, { adults: 4, children: 2 }] });
    expect(m.parties.map(partyLabel)).toEqual(['2a+1c', '4a+2c']);
    expect(m.warning).toBeUndefined();
  });

  it('accepts legacy headcounts but WARNS that the split is a guess', () => {
    const m = partiesFor({ compareOccupancies: [3, 6] });
    expect(m.warning).toMatch(/guess/i);
    expect(m.parties.map(partyLabel)).toEqual(['3a', '5a+1c']);   // the old, wrong derivation
  });

  it('falls back to the stated mix when nothing is configured', () => {
    expect(partiesFor(undefined).parties).toEqual(DEFAULT_PARTIES);
  });
});

describe('a headcount resolves to the RIGHT shape', () => {
  const mix = DEFAULT_PARTIES;
  it('3 guests is 2 adults + 1 child, NOT 3 adults', () => {
    expect(partyForGuests(mix, 3)).toEqual({ adults: 2, children: 1 });
  });
  it('6 guests is 4 adults + 2 children, NOT 5 adults + 1 child', () => {
    expect(partyForGuests(mix, 6)).toEqual({ adults: 4, children: 2 });
  });
  it('4 guests is 4 adults', () => {
    expect(partyForGuests(mix, 4)).toEqual({ adults: 4, children: 0 });
  });
  it('every configured party sums to its headcount', () => {
    for (const p of mix) expect(partySize(p)).toBe(p.adults + p.children);
  });
});

describe('the URLs carry adults and children separately', () => {
  const party = { adults: 4, children: 2 };

  it('Airbnb gets adults and children, never a combined count', () => {
    const u = buildCaptureUrl('airbnb', AIRBNB, { checkIn: '2026-11-06', checkOut: '2026-11-08', party })!;
    expect(u).toContain('adults=4');
    expect(u).toContain('children=2');
    expect(u).not.toContain('adults=6');
  });

  it('Booking gets one age per child, because it prices by age', () => {
    const u = buildCaptureUrl('booking.com', BOOKING, { checkIn: '2026-11-06', checkOut: '2026-11-08', party })!;
    expect(u).toContain('group_adults=4');
    expect(u).toContain('group_children=2');
    expect(u.match(/&age=\d+/g)).toHaveLength(2);
  });

  it('omits children entirely for an adults-only party', () => {
    const u = buildCaptureUrl('airbnb', AIRBNB, {
      checkIn: '2026-11-06', checkOut: '2026-11-08', party: { adults: 4, children: 0 } })!;
    expect(u).toContain('adults=4');
    expect(u).not.toContain('children');
  });

  it('never asks any channel for more adults than the property takes', () => {
    for (const p of DEFAULT_PARTIES) {
      for (const ch of ['airbnb', 'booking.com'] as const) {
        const u = buildCaptureUrl(ch, ch === 'airbnb' ? AIRBNB : BOOKING,
          { checkIn: '2026-11-06', checkOut: '2026-11-08', party: p })!;
        const adults = Number(u.match(/(?:group_)?adults=(\d+)/)![1]);
        expect(adults).toBeLessThanOrEqual(5);
      }
    }
  });
});
