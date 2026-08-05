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
