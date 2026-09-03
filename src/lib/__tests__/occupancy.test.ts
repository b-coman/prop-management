/**
 * The occupancy rule, and the pin that protects the WhatsApp wording.
 *
 * `formatGuestCount` was MOVED here out of `housekeepingService`. The string table below is the exact
 * output of the version that has been sending real messages to the cleaner, so a future edit that
 * changes the wording fails here rather than in her inbox.
 */
import {
  validateParty,
  maxChildrenFor,
  maxAdultsFor,
  formatGuestCount,
  capacityParts,
  asLanguage,
  hadChildren,
  childrenShare,
  splitHeadcount,
  clampParty,
} from '../occupancy';

/** Prahova: 7 people, at most 5 of them adults. */
const CHALET = { maxGuests: 7, maxAdults: 5 };
/** Coltei: a ceiling and no adult cap — the multi-property case. */
const FLAT = { maxGuests: 5 };

describe('validateParty', () => {
  it('accepts every shape the owner named', () => {
    for (const p of [{ adults: 5, children: 2 }, { adults: 4, children: 3 }, { adults: 3, children: 4 }, { adults: 2, children: 5 }]) {
      expect(validateParty(p, CHALET)).toEqual({ ok: true });
    }
  });

  it('accepts a solo traveller — the two-adult minimum was declined', () => {
    expect(validateParty({ adults: 1, children: 0 }, CHALET)).toEqual({ ok: true });
  });

  it('accepts one adult with six children, which the rule permits', () => {
    expect(validateParty({ adults: 1, children: 6 }, CHALET)).toEqual({ ok: true });
  });

  it('refuses children with no adult', () => {
    expect(validateParty({ adults: 0, children: 3 }, CHALET)).toEqual({ ok: false, reason: 'no_adult' });
  });

  it('refuses 6 adults even though 6 people would fit', () => {
    // The case the whole change exists for: under the ceiling, over the adult cap.
    expect(validateParty({ adults: 6, children: 0 }, CHALET)).toEqual({ ok: false, reason: 'too_many_adults' });
  });

  it('refuses 7 adults, which the site would sell today', () => {
    expect(validateParty({ adults: 7, children: 0 }, CHALET)).toEqual({ ok: false, reason: 'too_many_adults' });
  });

  it('refuses a headcount over the ceiling', () => {
    expect(validateParty({ adults: 5, children: 3 }, CHALET)).toEqual({ ok: false, reason: 'too_many_guests' });
    expect(validateParty({ adults: 2, children: 6 }, CHALET)).toEqual({ ok: false, reason: 'too_many_guests' });
  });

  it('reports the adult cap before the ceiling, because it is the more surprising refusal', () => {
    // 8 adults breaks both rules. Saying "too many guests" would not explain why 6 was also refused.
    expect(validateParty({ adults: 8, children: 0 }, CHALET)).toEqual({ ok: false, reason: 'too_many_adults' });
  });

  it('applies only the ceiling when a property caps no adults', () => {
    expect(validateParty({ adults: 5, children: 0 }, FLAT)).toEqual({ ok: true });
    expect(validateParty({ adults: 6, children: 0 }, FLAT)).toEqual({ ok: false, reason: 'too_many_guests' });
  });

  it('rejects malformed input rather than coercing it', () => {
    expect(validateParty({ adults: 2.5, children: 0 }, CHALET)).toEqual({ ok: false, reason: 'malformed' });
    expect(validateParty({ adults: 2, children: -1 }, CHALET)).toEqual({ ok: false, reason: 'malformed' });
    expect(validateParty({ adults: NaN, children: 0 }, CHALET)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('maxChildrenFor / maxAdultsFor', () => {
  it('moves as the adult count moves — this is why maxChildren is not stored', () => {
    expect(maxChildrenFor(1, CHALET)).toBe(6);
    expect(maxChildrenFor(4, CHALET)).toBe(3);
    expect(maxChildrenFor(5, CHALET)).toBe(2);
  });

  it('never goes negative', () => {
    expect(maxChildrenFor(9, CHALET)).toBe(0);
  });

  it('takes whichever adult limit binds first', () => {
    expect(maxAdultsFor(CHALET)).toBe(5);
    expect(maxAdultsFor(FLAT)).toBe(5);
    expect(maxAdultsFor({ maxGuests: 3, maxAdults: 5 })).toBe(3);
  });
});

describe('formatGuestCount — pinned against the live WhatsApp wording', () => {
  const CASES: Array<[number, number, 'ro' | 'en', string]> = [
    [1, 0, 'ro', '1 adult'],
    [2, 0, 'ro', '2 adulti'],
    [2, 1, 'ro', '2 adulti, 1 copil'],
    [3, 2, 'ro', '3 adulti, 2 copii'],
    [1, 1, 'ro', '1 adult, 1 copil'],
    [1, 0, 'en', '1 adult'],
    [2, 0, 'en', '2 adults'],
    [2, 1, 'en', '2 adults, 1 child'],
    [3, 2, 'en', '3 adults, 2 children'],
  ];

  it.each(CASES)('(%i adults, %i children, %s) → "%s"', (adults, children, lang, expected) => {
    expect(formatGuestCount(adults, children, lang)).toBe(expected);
  });

  it('carries no Romanian diacritics, because WhatsApp is the destination', () => {
    expect(formatGuestCount(3, 2, 'ro')).not.toMatch(/[ăâîșț]/);
  });
});




describe('capacityParts', () => {
  it('separates the fact from its qualifier so the UI can style them apart', () => {
    expect(capacityParts(CHALET, 'ro')).toEqual({
      primary: 'până la 7 persoane',
      qualifier: '(max. 5 adulți)',
    });
  });

  it('has no qualifier when no adult cap binds', () => {
    expect(capacityParts(FLAT, 'en')).toEqual({ primary: 'up to 5 guests', qualifier: null });
  });

});

describe('asLanguage', () => {
  it('keeps Romanian and treats everything else as English', () => {
    expect(asLanguage('ro')).toBe('ro');
    expect(asLanguage('en')).toBe('en');
    expect(asLanguage('de')).toBe('en');
    expect(asLanguage(undefined)).toBe('en');
    expect(asLanguage(null)).toBe('en');
  });
});

describe('hadChildren / childrenShare — unknown is not zero', () => {
  it('distinguishes a recorded zero from a missing value', () => {
    expect(hadChildren({ numberOfChildren: 2 })).toBe(true);
    expect(hadChildren({ numberOfChildren: 0 })).toBe(false);
    expect(hadChildren({ numberOfChildren: null })).toBeNull();
    expect(hadChildren({})).toBeNull();
  });

  it('computes the share over what is known, and says what that was', () => {
    // Two known (one with children), two never recorded. The old form said 25%; it is 50% of what
    // was actually recorded, and the caller can now see it rests on two bookings out of four.
    const set = [{ numberOfChildren: 2 }, { numberOfChildren: 0 }, { numberOfChildren: null }, {}];
    expect(childrenShare(set)).toEqual({ pct: 50, knownOf: 2, ofTotal: 4 });
  });

  it('reports null rather than 0% when nothing is known', () => {
    expect(childrenShare([{}, { numberOfChildren: null }])).toEqual({ pct: null, knownOf: 0, ofTotal: 2 });
  });

  it('handles an empty set', () => {
    expect(childrenShare([])).toEqual({ pct: null, knownOf: 0, ofTotal: 0 });
  });
});

describe('splitHeadcount', () => {
  it('preserves the headcount and pushes the overflow to children', () => {
    expect(splitHeadcount(7, CHALET)).toEqual({ adults: 5, children: 2 });
    expect(splitHeadcount(6, CHALET)).toEqual({ adults: 5, children: 1 });
    expect(splitHeadcount(4, CHALET)).toEqual({ adults: 4, children: 0 });
    expect(splitHeadcount(1, CHALET)).toEqual({ adults: 1, children: 0 });
  });

  it('never produces an illegal party, whatever it is handed', () => {
    for (const n of [-3, 0, 1, 7, 8, 99, 2.7, NaN]) {
      expect(validateParty(splitHeadcount(n as number, CHALET), CHALET)).toEqual({ ok: true });
    }
  });

  it('needs no children when the property caps no adults', () => {
    expect(splitHeadcount(5, FLAT)).toEqual({ adults: 5, children: 0 });
  });
});

describe('clampParty', () => {
  it('gives way on children when adults rise, because adults is what was just touched', () => {
    expect(clampParty({ adults: 5, children: 3 }, CHALET)).toEqual({ adults: 5, children: 2 });
    expect(clampParty({ adults: 4, children: 6 }, CHALET)).toEqual({ adults: 4, children: 3 });
  });

  it('leaves a legal party alone', () => {
    expect(clampParty({ adults: 2, children: 2 }, CHALET)).toEqual({ adults: 2, children: 2 });
  });

  it('always returns something valid', () => {
    for (const p of [{ adults: 0, children: 0 }, { adults: 9, children: 9 }, { adults: 1, children: -2 }]) {
      expect(validateParty(clampParty(p, CHALET), CHALET)).toEqual({ ok: true });
    }
  });
});

describe('formatGuestCount diacritics option', () => {
  it('is off by default, which is what WhatsApp gets', () => {
    expect(formatGuestCount(3, 1, 'ro')).toBe('3 adulti, 1 copil');
  });

  it('turns on for email, where the surrounding Romanian carries diacritics', () => {
    expect(formatGuestCount(3, 1, 'ro', { diacritics: true })).toBe('3 adulți, 1 copil');
  });

  it('changes nothing else — one adult and every English form are untouched', () => {
    expect(formatGuestCount(1, 0, 'ro', { diacritics: true })).toBe('1 adult');
    expect(formatGuestCount(3, 2, 'en', { diacritics: true })).toBe('3 adults, 2 children');
  });
});
