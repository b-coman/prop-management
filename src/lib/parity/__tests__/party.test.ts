/**
 * The party shape is configuration, not something to derive. These tests exist because deriving it
 * put 38 wrong prices in the store: "6 guests" became 6 adults, a party this property cannot host.
 */
import { partiesFor, partyForGuests, buildCaptureUrl, partySize, partyLabel, childAges, DEFAULT_PARTIES, type Party } from '../party';

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

describe('an infant is a different product from a child', () => {
  // Booking hosts 0-2 free and charges for 3-17 (the owner's own settings, confirmed 2026-09-09),
  // while the direct engine charges the same per-head fee whatever the age. So a family with a baby
  // is the shape where direct is structurally dearest — and the standard mix (ages 10 and 4) can
  // never show it, because both of those are children to every channel.
  const infantParty: Party = { adults: 4, children: 1, childAges: [1] };

  it("uses the party's own ages rather than the property-wide list", () => {
    expect(childAges(infantParty)).toEqual([1]);
    expect(childAges({ adults: 2, children: 1 })).toEqual([10]); // falls back to CHILD_AGES
  });

  it('labels an infant apart from a child, so two measurements cannot read as a repeat', () => {
    expect(partyLabel(infantParty)).toBe('4a+1i');
    expect(partyLabel({ adults: 4, children: 1 })).toBe('4a+1c');
    expect(partyLabel({ adults: 4, children: 2, childAges: [10, 1] })).toBe('4a+1c+1i');
  });

  it('sends the infant to Airbnb as an infant, not as a child', () => {
    const url = buildCaptureUrl('airbnb', 'https://www.airbnb.com/rooms/43265214',
      { checkIn: '2026-11-27', checkOut: '2026-12-01', party: infantParty })!;
    expect(url).toContain('adults=4');
    expect(url).toContain('infants=1');
    expect(url).not.toContain('children=');
  });

  it('sends the real age to Booking, which is what makes it free there', () => {
    const url = buildCaptureUrl('booking.com', 'https://www.booking.com/hotel/ro/x.html',
      { checkIn: '2026-11-27', checkOut: '2026-12-01', party: infantParty })!;
    expect(url).toContain('group_adults=4');
    expect(url).toContain('group_children=1');
    expect(url).toContain('age=1');
  });

  it('leaves the existing mix untouched — no infants, so no behaviour change', () => {
    const url = buildCaptureUrl('airbnb', 'https://www.airbnb.com/rooms/43265214',
      { checkIn: '2026-11-27', checkOut: '2026-12-01', party: { adults: 4, children: 2 } })!;
    expect(url).toContain('children=2');
    expect(url).not.toContain('infants=');
  });
});

describe('two parties of the same size are one cell', () => {
  // cellId keys on the headcount, never the shape, so a mix with two parties of the same size has
  // them overwriting each other in the store — and they can price very differently on the OTAs.
  it('warns when the configured mix has a headcount collision', () => {
    const mix = partiesFor({ compareParties: [
      { adults: 5, children: 0 },
      { adults: 4, children: 1, childAges: [1] },   // also 5 guests
    ] });
    expect(mix.warning).toMatch(/two parties of 5 guests/);
    expect(mix.warning).toMatch(/overwrites/);
  });

  it('says nothing when every party has its own size', () => {
    const mix = partiesFor({ compareParties: [
      { adults: 2, children: 1 }, { adults: 4, children: 0 },
      { adults: 4, children: 2 }, { adults: 5, children: 2, childAges: [10, 1] },
    ] });
    expect(mix.warning).toBeUndefined();
  });
});
