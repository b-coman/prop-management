import { validateDrafts, type GuestForDraftValidation } from '../validateDrafts';
import type { DraftMessage } from '../contracts';

const facts = [{ key: 'firstName', value: 'Marius' }, { key: 'requestedPeriod', value: '2026-08-16 → 2026-08-21' }];

// Filler long enough to clear minChars, deliberately free of self-ID and opt-out markers so each
// test controls exactly one variable.
const FILLER = ' Va scriu pentru ca in perioada urmatoare avem cateva zile libere la munte, iar toamna e chiar frumoasa pe aici, cu liniste multa si aer curat. Daca va tenteaza o escapada scurta, va pot tine la curent cu ce se elibereaza in calendar, fara nicio obligatie.';
const SELF_ID = ' Bogdan sunt, de la casuta din Comarnic.';
const OPT_OUT = ' Daca preferati sa nu va mai scriu, spuneti-mi linistit.';

const lead = (over: Partial<GuestForDraftValidation> = {}): GuestForDraftValidation => ({
  guestId: 'g1', groundedFacts: facts, thread: [{}, {}, {}],
  audienceKind: 'lead', relationshipState: 'active', ...over,
});
const draft = (body: string, factsUsed: string[] = ['firstName']): DraftMessage =>
  ({ guestId: 'g1', body, factsUsed } as DraftMessage);

describe('validateDrafts — a lead never stayed', () => {
  it('REJECTS a draft that asserts a past stay for a lead', () => {
    const r = validateDrafts([lead()], [draft(`Buna Marius! Sper ca v-a placut sejurul la noi.${FILLER}${SELF_ID}${OPT_OUT}`)]);
    expect(r.ok).toBe(false);
    expect(r.perGuest[0].errors.join(' ')).toMatch(/claims a past stay/);
  });

  it('accepts the same warmth built on the REQUEST instead of a stay', () => {
    const r = validateDrafts([lead()], [draft(`Buna Marius! Ati intrebat de 16-21 august si atunci era ocupat.${FILLER}${SELF_ID}${OPT_OUT}`, ['firstName', 'requestedPeriod'])]);
    expect(r.perGuest[0].errors).toEqual([]);
  });

  it('does not police stay language for a guest who really stayed', () => {
    const r = validateDrafts(
      [lead({ audienceKind: 'guest' })],
      [draft(`Buna Marius! Sper ca v-a placut sejurul la noi.${FILLER}${SELF_ID}`)],
    );
    expect(r.perGuest[0].errors).toEqual([]);
  });

  it('warns when a lead gets no opt-out, even mid-conversation', () => {
    const r = validateDrafts([lead()], [draft(`Buna Marius!${FILLER}${SELF_ID}`)]);
    expect(r.perGuest[0].warnings.join(' ')).toMatch(/opt-out/);
  });
});

describe('validateDrafts — relationship state beats thread length', () => {
  it('treats a phone-only relationship (empty thread, logged call) as NOT a first contact', () => {
    const r = validateDrafts(
      [{ guestId: 'g1', groundedFacts: facts, thread: [], relationshipState: 'active' }],
      [draft(`Buna Marius!${FILLER}`)],
    );
    expect(r.perGuest[0].errors).toEqual([]);                                   // no hard self-ID demand
    expect(r.perGuest[0].warnings.join(' ')).toMatch(/self-identification/);    // just a nudge
  });

  it('still hard-errors on a missing self-ID for a genuine first contact', () => {
    const r = validateDrafts(
      [{ guestId: 'g1', groundedFacts: facts, thread: [], relationshipState: 'first-contact' }],
      [draft(`Buna Marius!${FILLER}`)],
    );
    expect(r.ok).toBe(false);
    expect(r.perGuest[0].errors.join(' ')).toMatch(/self-identification/);
  });

  it('falls back to thread length when the pack gives no relationship state', () => {
    const r = validateDrafts(
      [{ guestId: 'g1', groundedFacts: facts, thread: [] }],
      [draft(`Buna Marius!${FILLER}`)],
    );
    expect(r.ok).toBe(false);   // empty thread ⇒ first contact ⇒ self-ID required (legacy behaviour)
  });
});

describe('validateDrafts - the offer is the owner\'s, never invented', () => {
  const guest = (over: Partial<GuestForDraftValidation> = {}) => lead({ audienceKind: 'guest', ...over });
  const noDiscount = { offer: { type: 'none' as const, description: 'first refusal' }, intent: 'gap_fill' };

  it('REJECTS a percentage when the campaign has no discount', () => {
    const r = validateDrafts([guest()], [draft(`Buna Marius!${FILLER} Ai 10% direct fata de pretul de pe platforme.${SELF_ID}`)], noDiscount);
    expect(r.ok).toBe(false);
    expect(r.perGuest[0].errors.join(' ')).toMatch(/NO discount/);
  });

  it('REJECTS "reducere" when discountPct is null', () => {
    const r = validateDrafts([guest()], [draft(`Buna Marius!${FILLER} Iti fac si o reducere.${SELF_ID}`)],
      { offer: { discountPct: null, description: 'first refusal' }, intent: 'gap_fill' });
    expect(r.ok).toBe(false);
  });

  it('REJECTS discount words on a no-ask share, whatever the offer says', () => {
    const r = validateDrafts([guest()], [draft(`Buna Marius!${FILLER} Ai 15% reducere.${SELF_ID}`)],
      { offer: { discountPct: 15, description: '15%' }, intent: 'share' });
    expect(r.ok).toBe(false);
  });

  it('ALLOWS a percentage when the owner set one', () => {
    const r = validateDrafts([guest()], [draft(`Buna Marius!${FILLER} Ai 10% reducere la rezervarea directa.${SELF_ID}`)],
      { offer: { discountPct: 10, description: '10%' }, intent: 'gap_fill' });
    expect(r.ok).toBe(true);
  });

  it('WARNS (does not block) when a direct-booking guest is sold "book direct"', () => {
    const r = validateDrafts([guest({ booksDirect: true })], [draft(`Buna Marius!${FILLER} Poti rezerva direct cu mine, mai bine ca pe Booking.${SELF_ID}`)], noDiscount);
    expect(r.ok).toBe(true);
    expect(r.perGuest[0].warnings.join(' ')).toMatch(/already books direct/);
  });

  it('is silent on channel talk for an OTA-only guest - it is their news', () => {
    const r = validateDrafts([guest()], [draft(`Buna Marius!${FILLER} Acum poti rezerva direct cu mine, la un pret mai bun decat pe Booking.${SELF_ID}`)], noDiscount);
    expect(r.perGuest[0].warnings.join(' ')).not.toMatch(/Booking\/Airbnb/);
  });
});

describe('validateDrafts - early access is not exclusivity', () => {
  it('WARNS when a message says nobody else will see the dates', () => {
    const r = validateDrafts([lead({ audienceKind: 'guest' })], [draft(`Buna Marius!${FILLER} Am vrut sa afli printre primii, pana nu il vede nimeni altcineva.${SELF_ID}`)]);
    expect(r.perGuest[0].warnings.join(' ')).toMatch(/not exclusivity/);
  });
});

describe('validateDrafts - with a master message', () => {
  const master = 'Buna! De sambata 28 noiembrie pana marti 1 decembrie ies patru zile libere. Trei nopti, cam 2.226 lei pentru 4 persoane.';
  it('WARNS when a guest message carries a price the master does not', () => {
    const r = validateDrafts([lead({ audienceKind: 'guest' })], [draft(`Buna Marius!${FILLER} Trei nopti, cam 2.046 lei pentru 3 persoane.${SELF_ID}`)], { masterMessage: master });
    expect(r.perGuest[0].warnings.join(' ')).toMatch(/numbers the master message does not: 2046 -/);
  });
  it('accepts the master\'s own numbers in either format', () => {
    const r = validateDrafts([lead({ audienceKind: 'guest' })], [draft(`Buna Marius!${FILLER} Pe 28 noiembrie, 2226 lei pentru 4 persoane.${SELF_ID}`)], { masterMessage: master });
    expect(r.perGuest[0].warnings.join(' ')).not.toMatch(/numbers the master/);
  });
});

describe('validateDrafts - taste claims need evidence', () => {
  it('WARNS on "stiu ca ti-a placut" with no review or note', () => {
    const r = validateDrafts([lead({ audienceKind: 'guest' })], [draft(`Salut Marius!${FILLER} Stiu ca ti-a placut toamna acolo.${SELF_ID}`)]);
    expect(r.perGuest[0].warnings.join(' ')).toMatch(/no review or note backs it/);
  });
  it('is quiet when a review backs it', () => {
    const g = lead({ audienceKind: 'guest', groundedFacts: [...facts, { key: 'reviewPraised:Peaceful', value: 'Peaceful' }] });
    const r = validateDrafts([g], [draft(`Salut Marius!${FILLER} Linistea care stiu ca ti-a placut.${SELF_ID}`, ['firstName', 'reviewPraised:Peaceful'])]);
    expect(r.perGuest[0].warnings.join(' ')).not.toMatch(/no review or note/);
  });
});

describe('validateDrafts - picking up the conversation', () => {
  const thread = [{ ts: '2026-06-16T10:00:00', dir: 'in', text: 'o sa revin pentru iulie sau august' }];
  it('accepts a thread:<ts> citation of a message that exists', () => {
    const r = validateDrafts([lead({ audienceKind: 'guest', thread })], [draft(`Salut Marius!${FILLER} Ziceai de vara.${SELF_ID}`, ['firstName', 'thread:2026-06-16T10:00:00'])]);
    expect(r.perGuest[0].errors).toEqual([]);
    expect(r.perGuest[0].warnings.join(' ')).not.toMatch(/mass message/);
  });
  it('REJECTS a citation of a message that is not in the thread', () => {
    const r = validateDrafts([lead({ audienceKind: 'guest', thread })], [draft(`Salut Marius!${FILLER}${SELF_ID}`, ['firstName', 'thread:2026-06-17T10:00:00'])]);
    expect(r.perGuest[0].errors.join(' ')).toMatch(/ungrounded/);
  });
  it('WARNS when they talked to you and the message picks up nothing', () => {
    const r = validateDrafts([lead({ audienceKind: 'guest', thread })], [draft(`Salut Marius!${FILLER}${SELF_ID}`)]);
    expect(r.perGuest[0].warnings.join(' ')).toMatch(/mass message/);
  });
});
