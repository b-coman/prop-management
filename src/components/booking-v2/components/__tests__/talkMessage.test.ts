/**
 * The prefilled WhatsApp message is now the page's primary conversion route, so what it says is
 * load-bearing rather than cosmetic.
 *
 * The regression that prompted these: the quoted total was sent as `pricing.totalPrice` +
 * `pricing.currency` — the pricing API's BASE currency, not the one on screen. A visitor reading
 * "1,415 lei" could send "284 EUR", so the conversation opened with the owner and the guest
 * disagreeing about the price. The fix is that the caller now passes the already-formatted string the
 * screen renders, and `shownTotal` is deliberately typed as a string for exactly that reason: there
 * is no raw number here to convert wrongly.
 */
import { buildTalkMessageLines } from '../GuestContactActions';

/** Stand-in for the real `t`: renders the fallback with {{var}} interpolation, like LanguageProvider. */
const t = (_key: string, fallback: string, vars?: Record<string, string | number>) =>
  Object.entries(vars ?? {}).reduce(
    (out, [k, v]) => out.replace(new RegExp(`{{${k}}}`, 'g'), String(v)),
    fallback,
  );

const base = { propertyName: 'Prahova Mountain Chalet', guestCount: 5, t } as const;

describe('buildTalkMessageLines', () => {
  it('carries dates, party size and the quoted total', () => {
    const lines = buildTalkMessageLines({
      ...base, variant: 'general', stay: '14 sept – 17 sept', shownTotal: '1,415 lei',
    });
    expect(lines).toEqual([
      "Hello! I'm interested in Prahova Mountain Chalet.",
      'Dates: 14 sept – 17 sept, 5 guests.',
      'Quoted total: 1,415 lei.',
    ]);
  });

  it('quotes the total exactly as given, with no second currency label', () => {
    // The template used to be "{{total}} {{currency}}". Passing a formatted string into that would
    // have produced "1,415 lei RON."
    const [, , quoted] = buildTalkMessageLines({
      ...base, variant: 'general', stay: '2 oct – 4 oct', shownTotal: '1,253 lei',
    });
    expect(quoted).toBe('Quoted total: 1,253 lei.');
    expect(quoted).not.toMatch(/RON|EUR|USD/);
  });

  it('passes a euro total through unchanged, so the message follows the currency switcher', () => {
    const lines = buildTalkMessageLines({
      ...base, variant: 'general', stay: 'Oct 2 – Oct 4', shownTotal: '€253',
    });
    expect(lines[2]).toBe('Quoted total: €253.');
  });

  it('omits the total line entirely when there is no price', () => {
    const lines = buildTalkMessageLines({
      ...base, variant: 'general', stay: '14 sept – 17 sept', shownTotal: null,
    });
    expect(lines).toHaveLength(2);
    expect(lines.join('\n')).not.toMatch(/total/i);
  });

  it('omits the dates line when the visitor has no dates', () => {
    const lines = buildTalkMessageLines({ ...base, variant: 'general', stay: null, shownTotal: null });
    expect(lines).toEqual(["Hello! I'm interested in Prahova Mountain Chalet."]);
  });

  it('asks rather than states in the no-dates entry state', () => {
    const lines = buildTalkMessageLines({ ...base, variant: 'no-dates', stay: null, shownTotal: null });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Which dates do you have free?');
  });

  it('names the attempted stay when the dates came back unavailable', () => {
    const lines = buildTalkMessageLines({
      ...base, variant: 'unavailable', stay: '23 sept – 30 sept', shownTotal: null,
    });
    expect(lines).toEqual(['Hello! I tried 23 sept – 30 sept at Prahova Mountain Chalet but those dates show as taken. What else is free?']);
  });

  it('falls back to the general message when unavailable has no stay to name', () => {
    // Guard against "I tried null at ..." — the variant needs a stay, and without one it must not
    // produce a sentence with a hole in it.
    const lines = buildTalkMessageLines({ ...base, variant: 'unavailable', stay: null, shownTotal: null });
    expect(lines[0]).not.toContain('null');
    expect(lines[0]).toContain("I'm interested in");
  });

  it('never emits an unreplaced placeholder', () => {
    for (const variant of ['general', 'unavailable', 'no-dates'] as const) {
      const lines = buildTalkMessageLines({
        ...base, variant, stay: '14 sept – 17 sept', shownTotal: '1,415 lei',
      });
      expect(lines.join('\n')).not.toMatch(/\{\{|\}\}/);
    }
  });
});
