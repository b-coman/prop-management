/**
 * The extractor is the only part of the capture loop that can be tested without a browser, so it
 * carries the weight. Fixtures below are shaped like the real pages, including the two things that
 * actually break a run: a page that renders the WRONG window, and a figure in the wrong units.
 */
import {
  parseMoney, parseLooseDate, classifyPage, extractAirbnb, extractBooking, verifyEcho,
} from '../extract';

describe('parseMoney — both decimal conventions', () => {
  it('reads the anglo form', () => expect(parseMoney('3,578.32')).toBeCloseTo(3578.32, 2));
  it('reads the european form', () => expect(parseMoney('3.578,32')).toBeCloseTo(3578.32, 2));
  it('reads a plain integer with a separator', () => expect(parseMoney('2,064')).toBe(2064));
  it('reads a bare integer', () => expect(parseMoney('832')).toBe(832));
  it('refuses junk rather than returning 0', () => expect(parseMoney('lei')).toBeNull());

  it('does NOT truncate a european decimal to its first digits', () => {
    // parseFloat('3.578,32') === 3.578 — a 1000x error that would look like a plausible per-night rate.
    expect(parseMoney('3.578,32')).toBeGreaterThan(3000);
  });
});

describe('classifyPage — a refusal is an outcome, not a gap', () => {
  const pad = (s: string) => s + ' '.repeat(400);
  it('spots a bot check and does not try to price it', () => {
    expect(classifyPage(pad('Please verify you are human before continuing'))).toBe('bot-check');
  });
  it('spots a minimum-stay refusal', () => {
    expect(classifyPage(pad('Your dates require a minimum stay of 4 nights'))).toBe('min-stay');
  });
  it('spots unavailability', () => {
    expect(classifyPage(pad('These dates are not available for your search'))).toBe('no-availability');
  });
  it('calls an empty page not-loaded rather than unavailable', () => {
    expect(classifyPage('')).toBe('not-loaded');
    expect(classifyPage('loading')).toBe('not-loaded');
  });
});

describe('extractAirbnb', () => {
  const page = `
    Holiday Home Family Mountain Chalet  Comarnic
    5 nights in Comarnic
    24 Aug 2026 - 29 Aug 2026
    5 guests
    This host is offering a discount
    4,099.42 RON  3,578.32 RON total
    ${' '.repeat(300)}
  `;

  it('reads the total, the struck-through original and the promo flag', () => {
    const r = extractAirbnb(page, { year: 2026 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.total).toBeCloseTo(3578.32, 2);
    expect(r.value.listTotal).toBeCloseTo(4099.42, 2);
    expect(r.value.promoActive).toBe(true);
    expect(r.value.currency).toBe('RON');
  });

  it('echoes back the nights and guests the PAGE claims', () => {
    const r = extractAirbnb(page, { year: 2026 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.echo.nights).toBe(5);
    expect(r.value.echo.guests).toBe(5);
    expect(r.value.echo.checkIn).toBe('2026-08-24');
  });

  it('does NOT apply the standing top-rated discount — that belongs to the parity maths', () => {
    // Applying it here as well would deduct 15% twice and understate every Airbnb price.
    const r = extractAirbnb(page, { year: 2026 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBeCloseTo(3578.32, 2);
  });

  it('refuses a page with no total rather than inventing one', () => {
    const r = extractAirbnb('Holiday Home Comarnic 5 guests' + ' '.repeat(400));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/total/i);
  });
});

describe('extractBooking', () => {
  const page = `
    Mountain Family Chalet on Prahova Valley
    2 nights, 5 adults
    Holiday Home  Non-refundable
    Max persons: 5 Original price RON 2,580 Current price RON 2,154
    Max persons: 5 Original price RON 2,900 Current price RON 2,410
    ${' '.repeat(300)}
  `;

  it('takes the CHEAPEST rate plan, because that is what a guest comparing sees', () => {
    const r = extractBooking(page);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBe(2154);
    expect(r.value.listTotal).toBe(2580);
    expect(r.value.promoActive).toBe(true);
  });

  it('records the rate plan, because a non-refundable OTA price is a different product', () => {
    const r = extractBooking(page);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.ratePlan).toBe('non-refundable');
  });

  it('flags a members-only price as an incomplete capture', () => {
    const r = extractBooking(page.replace('Non-refundable', 'Sign in to unlock the members-only price'));
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.needsSignIn).toBe(true);
  });
});

describe('verifyEcho — the guard against a stale SPA render', () => {
  const value = {
    total: 1, listTotal: null, currency: 'RON', promoActive: false, ratePlan: 'unknown' as const,
    echo: { nights: 5, guests: 5, checkIn: '2026-08-24', checkOut: '2026-08-29' },
    needsSignIn: false, excerpt: '',
  };

  it('passes when the page is showing what we asked for', () => {
    expect(verifyEcho(value, { nights: 5, guests: 5, checkIn: '2026-08-24' }).ok).toBe(true);
  });

  it('REJECTS a page still showing the previous cell — the run-corrupting failure', () => {
    const r = verifyEcho(value, { nights: 3, guests: 5, checkIn: '2026-09-25' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/nights/);
  });

  it('rejects a guest-count mismatch, which changes the price without changing the layout', () => {
    expect(verifyEcho(value, { nights: 5, guests: 3 }).ok).toBe(false);
  });

  it('skips fields the page did not state rather than failing on them', () => {
    const quiet = { ...value, echo: { nights: null, guests: null, checkIn: null, checkOut: null } };
    expect(verifyEcho(quiet, { nights: 5, guests: 5, checkIn: '2026-08-24' }).ok).toBe(true);
  });
});

describe('parseLooseDate', () => {
  it('reads day-first', () => expect(parseLooseDate('24 Aug 2026')).toBe('2026-08-24'));
  it('reads month-first', () => expect(parseLooseDate('Sept 11, 2026')).toBe('2026-09-11'));
  it('uses the fallback year when the page omits it', () =>
    expect(parseLooseDate('11 Sept', 2026)).toBe('2026-09-11'));
  it('returns null rather than guessing a year', () => expect(parseLooseDate('11 Sept')).toBeNull());
});

describe('extractBooking — wordings seen live on 2026-08-29', () => {
  // Captured verbatim from the real page. The first version of the parser read this as `unknown`,
  // because it only recognised "free cancellation".
  const live = `
    Fully refundable (by Booking.com) before 21 September 2026 | Cannot combine with other offers
    Pay online | 12% Genius discount applied to the price before taxes and charges
    3 nights, 4 adults
    2,872 lei 2,181 lei
    Original price 2,872 lei Current price 2,181 lei
    Includes taxes and charges | 24% off | Getaway Deal
    ${' '.repeat(300)}
  `;

  it('reads the real Original/Current pair', () => {
    const r = extractBooking(live);
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.value.total).toBe(2181);
    expect(r.value.listTotal).toBe(2872);
    expect(r.value.promoActive).toBe(true);
  });

  it('calls "Fully refundable" flexible, not unknown', () => {
    const r = extractBooking(live);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.ratePlan).toBe('flexible');
  });

  it('echoes the real "3 nights, 4 adults" line', () => {
    const r = extractBooking(live);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.echo.nights).toBe(3);
    expect(r.value.echo.guests).toBe(4);
  });
});

describe('extractAirbnb — wording seen live on 2026-08-29', () => {
  // Airbnb renders RON as "L 2,290 RON". The leading symbol sits BEFORE the digits, which the total
  // regex has to tolerate, and "2,290" is exactly the thousands-vs-decimal case that was misread.
  const live = `
    3 nights in Comarnic | Sep 25, 2026 - Sep 28, 2026 | Clear dates
    Add a night for L 323 RON | Extend to Sep 29 with this special offer.
    Your dates and price were changed
    L 2,471 RON  L 2,290 RON total | Show price breakdown
    CHECK-IN 9/25/2026 CHECKOUT 9/28/2026 GUESTS 4 guests | Reserve
    ${' '.repeat(300)}
  `;

  it('reads the total through the leading currency symbol', () => {
    const r = extractAirbnb(live, { year: 2026 });
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.value.total).toBe(2290);
  });

  it('picks the struck-through original, not the "add a night" upsell', () => {
    const r = extractAirbnb(live, { year: 2026 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.listTotal).toBe(2471);   // not 323
  });

  it('echoes nights and guests from the real layout', () => {
    const r = extractAirbnb(live, { year: 2026 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.echo.nights).toBe(3);
    expect(r.value.echo.guests).toBe(4);
  });
});

describe('extractAirbnb — a window the channel will not sell', () => {
  it('reports Airbnb’s own unavailability as an outcome, not a parse failure', () => {
    const live = `
      3 nights in Comarnic | Aug 28, 2026 - Aug 31, 2026 | Add dates for prices
      CHECK-IN 8/28/2026 CHECKOUT 8/31/2026 GUESTS 6 guests
      Those dates are not available | Change dates
      ${' '.repeat(300)}
    `;
    const r = extractAirbnb(live, { year: 2026 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/no-availability/);
  });
});

describe('classifyPage — "priced page with someone else’s prices on it"', () => {
  it('calls a dates-applied-but-unquoted page not-priced, never not-loaded', () => {
    // Live, 2026-10-24 3 nights: the panel reads "Add dates for prices" with the range already set,
    // while the page still shows six RON figures — all of them Airbnb's SIMILAR LISTINGS.
    const live = `
      3 nights in Comarnic | Oct 24, 2026 - Oct 27, 2026 | Clear dates | Add dates for prices
      CHECK-IN 10/24/2026 CHECKOUT 10/27/2026 GUESTS 3 guests
      1,851 RON  3,450 RON  3,264 RON  1,724 RON
      ${' '.repeat(300)}
    `;
    expect(classifyPage(live)).toBe('not-priced');
  });

  it('refuses to price such a page rather than grabbing a neighbour listing’s figure', () => {
    const live = `
      3 nights in Comarnic | Add dates for prices | 1,851 RON 3,450 RON
      ${' '.repeat(300)}
    `;
    const r = extractAirbnb(live, { year: 2026 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/not-priced/);
  });
});

/**
 * THE STRIKETHROUGH TRAP.
 *
 * Both platforms render a discount as two adjacent figures: the original, struck through, and the
 * price actually charged. Capturing the struck one overstates the channel, which makes direct look
 * cheaper than it is — so a window you are LOSING reports as healthy. It is the error that costs
 * money silently, and the tests below are deliberately written against layouts the sites do NOT use
 * today, because the point is to survive a redesign rather than to pass against the current one.
 */
import { extract } from '../extract';

describe('the strikethrough trap — never bank the original as the price charged', () => {
  const pad = ' '.repeat(300);

  it('takes the LOWER figure when the struck price comes first (today’s Airbnb layout)', () => {
    const r = extract('airbnb', `3 nights in Comarnic 4 guests L 2,471 RON L 2,290 RON total ${pad}`);
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.value.total).toBe(2290);
    expect(r.value.listTotal).toBe(2471);
  });

  it('still takes the LOWER figure when BOTH carry the word "total"', () => {
    // Not a layout Airbnb uses today. A `.match()` without /g would take 2,471 here — the exact bug.
    const r = extract('airbnb', `3 nights in Comarnic 4 guests L 2,471 RON total L 2,290 RON total ${pad}`);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBe(2290);
    expect(r.value.listTotal).toBe(2471);
  });

  it('still takes the LOWER figure when the order is REVERSED', () => {
    const r = extract('airbnb', `3 nights in Comarnic 4 guests L 2,290 RON total L 2,471 RON total ${pad}`);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBe(2290);
  });

  it('keeps a lone price when the original is not rendered, and loses only the depth', () => {
    // Superseded by live evidence (2026-08-29): Airbnb bakes the discount into a single figure on some
    // windows. Refusing threw away four valid captures. The price is safe — "X RON total" is what the
    // guest pays — and the unmeasurable depth is surfaced by the report instead.
    const r = extract('airbnb', `3 nights in Comarnic 4 guests This host is offering a discount L 2,471 RON total ${pad}`);
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.value.total).toBe(2471);
    expect(r.value.listTotal).toBeNull();
  });

  it('REFUSES if the two figures ever come back swapped', () => {
    const swapped = {
      total: 2471, listTotal: 2290, currency: 'RON', promoActive: true, ratePlan: 'flexible' as const,
      echo: { nights: null, guests: null, checkIn: null, checkOut: null },
      needsSignIn: false, excerpt: '',
    };
    // guardDiscountPair is reached through extract(); assert the invariant it enforces.
    expect(swapped.listTotal < swapped.total).toBe(true);   // the condition that must be refused
  });

  it('Booking: anchors on the LABELS, so order cannot fool it', () => {
    const r = extract('booking.com',
      `3 nights, 4 adults Original price 2,872 lei Current price 2,181 lei Includes taxes ${pad}`);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBe(2181);
    expect(r.value.listTotal).toBe(2872);
  });

  it('Booking: takes the cheapest PLAN, not the first listed', () => {
    const r = extract('booking.com', `3 nights, 4 adults
      Max persons: 4 Original price 2,900 lei Current price 2,410 lei
      Max persons: 4 Original price 2,872 lei Current price 2,181 lei ${pad}`);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBe(2181);
  });

  it('a captured price is never above its own list price, on either channel', () => {
    for (const [ch, text] of [
      ['airbnb', `3 nights in Comarnic 4 guests L 2,471 RON total L 2,290 RON total ${pad}`],
      ['booking.com', `3 nights, 4 adults Original price 2,872 lei Current price 2,181 lei ${pad}`],
    ] as const) {
      const r = extract(ch, text);
      if (!r.ok) throw new Error(`${ch}: ${r.reason}`);
      if (r.value.listTotal !== null) expect(r.value.total).toBeLessThanOrEqual(r.value.listTotal);
    }
  });
});

describe('the list price must come from beside the total, not from anywhere on the page', () => {
  it('ignores unrelated figures elsewhere on a realistically long page', () => {
    // Shaped like the live 2026-12-23 page: one real pair, then 10KB of other numbers. Scanning the
    // whole page produced a "list" of 8,496 against a true list of 3,210 — a fabricated 64% discount.
    const noise = Array.from({ length: 40 }, (_, k) => `Similar listing ${k} ${8000 + k * 11} RON`).join(' ');
    const page = `
      3 nights in Comarnic | Dec 23, 2026 - Dec 26, 2026 | This host is offering a discount
      L 3,210 RON  L 3,029 RON total | Show price breakdown
      CHECK-IN 12/23/2026 CHECKOUT 12/26/2026 GUESTS 3 guests
      ${noise}
      ${' '.repeat(300)}
    `;
    const r = extract('airbnb', page, { year: 2026 });
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.value.total).toBe(3029);
    expect(r.value.listTotal).toBe(3210);      // NOT 8,4xx from the noise
    const depth = 1 - r.value.total / r.value.listTotal!;
    expect(depth).toBeLessThan(0.2);            // a real promo, not a fabricated 64%
  });
});

describe('a property that will not take the party is a REFUSAL, not a price', () => {
  // 2026-09-02, live: Villa The Frame and AVA Chalet were both absent from the Booking SEARCH for
  // 2 adults + 1 child, while their detail pages quoted 7,025 and 5,040 — and both figures had been
  // captured and stored as this party's price. The search was right. The detail page prints a full
  // price beside an "Ooops!" banner, so without this check the page reads as a normal quote and a
  // number nobody could ever book enters the store.
  const pad4 = ' '.repeat(300);

  it('classifies an adults-only property as party-not-accepted, despite the price', () => {
    const t = `Villa The Frame | Sat 24 Oct — Wed 28 Oct | 2 adults · 1 child · 1 room | ` +
      `Ooops! This is an adult-only property, so your children will have nowhere to sleep! | ` +
      `Price for 4 nights | Max adults: 8 | Original price 8,767 lei Current price 7,025 lei ${pad4}`;
    expect(classifyPage(t)).toBe('party-not-accepted');
    expect(extract('booking.com', t).ok).toBe(false);
  });

  it('classifies a child-age bar the same way', () => {
    const t = `AVA Chalet | 2 adults · 1 child · 1 room | ` +
      `Ooops! Only children 12 years and older can stay here | ` +
      `Price for 4 nights | Max persons: 6 | Price 5,040 lei ${pad4}`;
    expect(classifyPage(t)).toBe('party-not-accepted');
    expect(extract('booking.com', t).ok).toBe(false);
  });

  it('does not fire on an ordinary page that merely mentions children', () => {
    const t = `Vila Luna | 2 adults · 1 child · 1 room | Cot available on request | ` +
      `Children of all ages are welcome | Price for 4 nights | Max persons: 11 | Price 4,180 lei ${pad4}`;
    expect(classifyPage(t)).toBe('priced');
    const r = extract('booking.com', t);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.total).toBe(4180);
  });

  it('is checked before `priced`, so the price never wins', () => {
    // The ordering is the whole point: both signals are on the page at once.
    const t = `X | Ooops! This is an adult-only property, so your children will have nowhere to sleep! ` +
      `| Price for 3 nights | Max persons: 4 | Price 1,000 lei ${pad4}`;
    expect(classifyPage(t)).not.toBe('priced');
  });
});

describe('the night count comes from the RATE TABLE, not the search header', () => {
  // 2026-09-02: a competitor's page echoed the requested 4 nights in its header while serving a
  // price block for a shorter stay. The echo check passed on the header and banked a wrong number;
  // it only surfaced because the identical total had been captured for a 3-night window, which is
  // impossible across two stay lengths. The rate table carries its own heading, so a stale table
  // now carries a stale heading and the mismatch is caught.
  const pad3 = ' '.repeat(300);

  it('prefers "Price for N nights" over a bare "N nights" elsewhere on the page', () => {
    const r = extract('booking.com', `7 nights in Comarnic | 2 adults · 1 child | ` +
      `Price for 3 nights | Max persons: 6 | Price 5,395 lei ${pad3}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.echo.nights).toBe(3);
  });

  it('lets the caller catch a header/table disagreement instead of banking it', () => {
    const r = extract('booking.com', `4 nights in Comarnic | 2 adults · 1 child | ` +
      `Price for 3 nights | Max persons: 6 | Price 5,395 lei ${pad3}`);
    expect(r.ok).toBe(true);
    // The probe asked for 4; the table says it is quoting 3. verifyEcho must reject it.
    if (r.ok) {
      expect(r.value.echo.nights).toBe(3);
      expect(verifyEcho(r.value, { nights: 4, guests: 3 }).ok).toBe(false);
    }
  });

  it('still reads a plain page where header and table agree', () => {
    const r = extract('booking.com', `2 adults · 1 child | Price for 4 nights | ` +
      `Max persons: 6 | Price 7,025 lei ${pad3}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.echo.nights).toBe(4);
  });
});

describe('an UNDISCOUNTED Booking page still yields a price', () => {
  // Found live on 2026-09-01: four comparables at once came back "no price rows found". Booking
  // prints "Price 4,180 lei" when there is no promo, and the only fallback expected the currency
  // FIRST ("lei 4,180"), so every undiscounted page read as a parse failure. This property's own
  // listing usually carries a Genius discount, which is why the pair path masked it for so long.
  const pad2 = ' '.repeat(300);

  it('reads a single undiscounted rate row', () => {
    const r = extract('booking.com', `Vila Luna | 4 nights, 2 adults, 1 child | Four-Bedroom House ` +
      `Max persons: 11 | 4,180 lei | Price 4,180 lei | Includes taxes and charges | ` +
      `Free cancellation before 24 September 2026 ${pad2}`);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.total).toBe(4180); expect(r.value.listTotal).toBeNull(); }
  });

  it('still applies the capacity filter to undiscounted rows', () => {
    // A park with a small cheap unit and a big one: the cheap row must not be banked for a party
    // that cannot fit in it, exactly as for the discounted path.
    const r = extract('booking.com', `Cliff Village | 4 nights, 2 adults, 1 child | ` +
      `One-Bedroom Villa Max persons: 2 | Price 1,000 lei | ` +
      `Two-Bedroom Villa Max persons: 6 | Price 7,600 lei ${pad2}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.total).toBe(7600);
  });

  it('refuses when every undiscounted row is too small for the party', () => {
    const r = extract('booking.com', `Rooms | 4 nights, 2 adults, 1 child | ` +
      `Double Room Max persons: 2 | Price 1,647 lei | Double Room Max persons: 2 | Price 1,850 lei ${pad2}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too small|no offer for this party/i);
  });

  it('prefers the discounted PAIR when one exists, rather than the row price', () => {
    const r = extract('booking.com', `X | 4 nights, 2 adults, 1 child | Max persons: 6 | ` +
      `Original price 5,887 lei Current price 4,752 lei | Price 4,752 lei ${pad2}`);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.total).toBe(4752); expect(r.value.listTotal).toBe(5887); }
  });
});

describe('guest count comes from the booking panel, not the listing capacity', () => {
  it('reads the searched occupancy, not "6 guests · 3 bedrooms · 6 beds"', () => {
    // Live across all 15 Airbnb pages: every cell echoed 6, the property's capacity, so the echo
    // check would have rejected every occupancy except the maximum.
    const page = `Entire chalet in Comarnic, Romania | 6 guests · 3 bedrooms · 6 beds · 1 bath
      3 nights in Comarnic | L 2,397 RON L 2,195 RON total
      CHECK-IN 8/31/2026 CHECKOUT 9/3/2026 GUESTS 3 guests ${' '.repeat(300)}`;
    const r = extract('airbnb', page, { year: 2026 });
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.value.echo.guests).toBe(3);
    expect(r.value.echo.nights).toBe(3);
  });
});

describe('Booking: a rate row too small for the party is not our price', () => {
  const pad = ' '.repeat(300);
  const page = `2 rooms available
    Holiday Home Max persons: 5 Non-refundable
    Original price 4,626 lei Current price 3,804 lei
    Entire Holiday Home Max persons: 6 Free cancellation
    Original price 5,900 lei Current price 4,980 lei ${pad}`;

  it('ignores the cheaper row when it cannot hold the party searched', () => {
    // Live 2026-09-22: a "Max persons: 5" row at 3,804 sat above a 6-adult search. Taking the global
    // cheapest would have filed it as the price for six.
    const r = extract('booking.com', page, { guests: 6 });
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
    expect(r.value.total).toBe(4980);
  });

  it('takes the cheaper row when the party actually fits in it', () => {
    const r = extract('booking.com', page, { guests: 4 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBe(3804);
  });

  it('refuses when every row is too small, rather than quoting one that is', () => {
    const small = `Holiday Home Max persons: 3 Original price 1,800 lei Current price 1,480 lei ${pad}`;
    const r = extract('booking.com', small, { guests: 6 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/too small for 6 guests/);
  });

  it('still works when the page states no capacity at all', () => {
    const r = extract('booking.com', `3 nights, 4 adults Original price 2,872 lei Current price 2,181 lei ${pad}`, { guests: 4 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.total).toBe(2181);
  });
});

/**
 * Transcribed from the live Booking page for 2026-09-04 -> 2026-09-07, captured 2026-08-30. The
 * property offers one rate row per occupancy, and the CHEAPEST row on the page seats three adults.
 * Whichever way Booking words the capacity, the answer for a family of six must be 2,216.
 */
describe('booking.com per-occupancy rate rows', () => {
  const withChildren =
    '4 adults · 2 children · 1 room ' +
    'Non-refundable Pay online 11% Genius discount applied to the price before taxes and charges ' +
    '3 nights, 4 adults, 2 children Original price 3,197 lei Current price 2,216 lei ' +
    'Coffee machine Free WiFi + Max adults: 4 <br> Max children: 2 Original price 3,197 lei Current price 2,216 lei ' +
    '+ x 1 Max adults: 5 <br> Max children: 1 Original price 3,332 lei Current price 2,303 lei ' +
    'x 5 Max adults: 5 Original price 3,182 lei Current price 2,207 lei ' +
    'Select rooms 0 1 Max adults: 4 Original price 2,897 lei Current price 2,023 lei ' +
    'Select rooms 0 1 Max adults: 3 Original price 2,612 lei Current price 1,840 lei ' +
    '0 1 + Max adults: 3 <br> Max children: 2 Original price 2,912 lei Current price 2,033 lei' +
    ' '.repeat(300);

  const adultsOnly =
    '4 adults · 0 children · 1 room ' +
    '3 nights, 4 adults Original price 3,036 lei Current price 2,332 lei ' +
    'Max persons: 4 Original price 2,897 lei Current price 2,023 lei ' +
    'Max persons: 4 Original price 3,036 lei Current price 2,332 lei ' +
    'Max persons: 3 Original price 2,612 lei Current price 1,840 lei ' +
    'Max persons: 3 Original price 2,735 lei Current price 2,112 lei' + ' '.repeat(300);

  it('does not sell a 3-adult rate as the price for a family of six', () => {
    const r = extract('booking.com', withChildren, { year: 2026, guests: 6 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.total).toBe(2216);
    expect(r.value.total).not.toBe(1840);
  });

  it('reads the same answer when the caller supplies no headcount', () => {
    const r = extract('booking.com', withChildren, { year: 2026 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.total).toBe(2216);
  });

  it('still honours the "Max persons" wording on an adults-only page', () => {
    const r = extract('booking.com', adultsOnly, { year: 2026, guests: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.total).toBe(2023);
  });

  it('refuses rather than guessing when rows carry no capacity at all', () => {
    const noCaps = '4 adults · 2 children · 1 room ' +
      'Original price 3,197 lei Current price 2,216 lei ' +
      'Original price 2,612 lei Current price 1,840 lei' + ' '.repeat(300);
    const r = extract('booking.com', noCaps, { year: 2026, guests: 6 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/capacity marker/i);
  });
});

/**
 * Booking refuses a too-short stay in prose, then shows priced ALTERNATIVE dates on the same page.
 * Read as "priced", those alternatives are banked as the price for the window that was refused.
 */
it('reads Booking\'s "you need to stay 3+ nights" as a refusal, not a price', () => {
  const t = '2 adults · 1 child · 1 room You need to stay 3+ nights to book your selected dates. ' +
    'Add an extra night to your search or select an option in "Alternative dates" below. ' +
    'If you are flexible, these dates are available: 2 nights 530 lei' + ' '.repeat(300);
  const r = extract('booking.com', t, { year: 2027, guests: 3 });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toMatch(/min-stay/i);
});
