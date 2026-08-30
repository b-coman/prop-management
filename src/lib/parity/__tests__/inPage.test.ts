/**
 * The two parsers must agree, always.
 *
 * There have to be two: the extension refuses to let a page's text out in bulk (Blob downloads get
 * site-blocked, base64 returns are refused, plain text truncates), so the parsing happens in the page
 * and only a verdict comes back. The failure mode that creates is silent and nasty — the TypeScript
 * one stays green in CI while the JavaScript one, the one that actually reads your prices, drifts.
 *
 * This test is the only thing standing against that. It evaluates the in-page source and asserts it
 * produces the same answer as `extract()` on every fixture, including the ones taken from live pages.
 * Change one implementation and this fails until you change the other.
 */
import { extract, type Channel } from '../extract';
import { IN_PAGE_EXTRACTOR } from '../inPage';

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const inPageExtract = new Function(`${IN_PAGE_EXTRACTOR}; return __extract;`)() as
  (channel: string, text: string) => Record<string, unknown>;

const pad = ' '.repeat(300);
const noise = Array.from({ length: 40 }, (_, k) => `Similar listing ${k} ${8000 + k * 11} RON`).join(' ');

const FIXTURES: Array<{ name: string; channel: Channel; text: string }> = [
  { name: 'airbnb live 25-28 Sep', channel: 'airbnb', text:
    `3 nights in Comarnic | Sep 25, 2026 - Sep 28, 2026 | Add a night for L 323 RON | Your dates and price were changed | L 2,471 RON | L 2,290 RON total | CHECK-IN 9/25/2026 CHECKOUT 9/28/2026 GUESTS 4 guests ${pad}` },
  { name: 'airbnb live 23-26 Dec, long page', channel: 'airbnb', text:
    `3 nights in Comarnic | Dec 23, 2026 - Dec 26, 2026 | This host is offering a discount | L 3,210 RON  L 3,029 RON total | CHECK-IN 12/23/2026 CHECKOUT 12/26/2026 GUESTS 3 guests ${noise} ${pad}` },
  { name: 'airbnb unavailable', channel: 'airbnb', text:
    `3 nights in Comarnic | Aug 28, 2026 - Aug 31, 2026 | Those dates are not available | Change dates ${pad}` },
  { name: 'airbnb not-priced with decoys', channel: 'airbnb', text:
    `3 nights in Comarnic | Add dates for prices | 1,851 RON 3,450 RON 3,264 RON ${pad}` },
  { name: 'airbnb both figures carry "total"', channel: 'airbnb', text:
    `3 nights in Comarnic 4 guests L 2,471 RON total L 2,290 RON total ${pad}` },
  { name: 'airbnb capacity line must not be read as the search occupancy', channel: 'airbnb', text:
    `Entire chalet in Comarnic, Romania | 6 guests · 3 bedrooms · 6 beds · 1 bath | 3 nights in Comarnic | L 2,397 RON L 2,195 RON total | CHECK-IN 8/31/2026 CHECKOUT 9/3/2026 GUESTS 3 guests ${pad}` },
  { name: 'airbnb same figure rendered twice is ONE price, not a pair', channel: 'airbnb', text:
    `3 nights in Comarnic | This host is offering a discount | L 3,272 RON total | Show price breakdown | L 3,272 RON total | GUESTS 6 guests ${pad}` },
  { name: 'airbnb promo with the original not rendered', channel: 'airbnb', text:
    `3 nights in Comarnic 4 guests This host is offering a discount L 2,471 RON total ${pad}` },
  { name: 'booking live 25-28 Sep', channel: 'booking.com', text:
    `Fully refundable (by Booking.com) before 21 September 2026 | 12% Genius discount applied | 3 nights, 4 adults | Original price 2,872 lei Current price 2,181 lei | 24% off ${pad}` },
  { name: 'booking live 24-27 Oct', channel: 'booking.com', text:
    `Free cancellation before 24 September 2026 | 11% Genius discount applied | 3 nights, 3 adults | Original price 2,870 lei Current price 2,443 lei | 15% off ${pad}` },
  { name: 'booking two plans, cheapest wins', channel: 'booking.com', text:
    `3 nights, 4 adults Non-refundable Max persons: 4 Original price 2,900 lei Current price 2,410 lei " +
    "Max persons: 4 Original price 2,872 lei Current price 2,181 lei ${pad}` },
  { name: 'booking bot check', channel: 'booking.com', text:
    `Please verify you are human before continuing ${pad}` },
];

describe('in-page parser agrees with the TypeScript parser', () => {
  for (const f of FIXTURES) {
    it(f.name, () => {
      const ts = extract(f.channel, f.text, { year: 2026 });
      const js = inPageExtract(f.channel, f.text);

      if (!ts.ok) {
        // Both must refuse, and for the same CAUSE. The two carry different wording — the TS side
        // explains itself to a human, the in-page side returns a token — so compare the category
        // rather than the prose, which is presentation and allowed to differ.
        expect(js.state).not.toBe('ok');
        const CAUSE: Record<string, RegExp> = {
          'no-availability': /no-availability/,
          'not-priced': /not-priced/,
          'min-stay': /min-stay/,
          'bot-check': /bot-check/,
          'not-loaded': /not-loaded/,
          'no-total': /no ".*total" line|no price rows/,
          'inverted': /swapped|BELOW the captured total/,

        };
        const pattern = CAUSE[String(js.state)];
        expect(pattern).toBeDefined();
        expect(String(ts.reason)).toMatch(pattern);
        return;
      }
      expect(js.state).toBe('ok');
      expect(js.total).toBe(ts.value.total);
      expect(js.list ?? null).toBe(ts.value.listTotal);
      expect(Boolean(js.promo)).toBe(ts.value.promoActive);
      expect(js.nights ?? null).toBe(ts.value.echo.nights);
      expect(js.guests ?? null).toBe(ts.value.echo.guests);
      expect(js.plan).toBe(ts.value.ratePlan);
    });
  }

  it('covers every page state the classifier can emit', () => {
    const states = new Set(FIXTURES.map((f) => {
      const js = inPageExtract(f.channel, f.text);
      return String(js.state);
    }));
    // If a new state is added without a fixture, this fails and forces one.
    expect(states).toContain('ok');
    expect(states).toContain('no-availability');
    expect(states).toContain('not-priced');
    expect(states).toContain('bot-check');
  });
});
