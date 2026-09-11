/**
 * The round-trip that was losing Romanian text.
 *
 * The bug was not a crash. Saving a property in admin quietly turned `{en, ro}` into the English
 * string, and nothing said so - not the form, not the action, not a log. It stayed invisible until
 * the booking page started rendering the field, at which point the same save would have shown
 * English cancellation terms to Romanian guests. So the assertion that matters most here is the
 * dullest one: load a bilingual value, save it unchanged, still bilingual.
 */
import { bilingualTextSchema } from '../bilingual-field';

const RO = 'Anulare gratuită cu până la 30 de zile înainte de check-in.';
const EN = 'Free cancellation up to 30 days before check-in.';

describe('bilingualTextSchema', () => {
  it('keeps both languages through a save that changed neither', () => {
    // THE REGRESSION. Under z.string() this arrived as '[object Object]' or the bare English half.
    const out = bilingualTextSchema.parse({ en: EN, ro: RO });
    expect(out).toEqual({ en: EN, ro: RO });
  });

  it('keeps the Romanian half when only the English one is edited', () => {
    const out = bilingualTextSchema.parse({ en: 'Edited in the EN tab.', ro: RO });
    expect(out).toEqual({ en: 'Edited in the EN tab.', ro: RO });
  });

  it('leaves a plain string as a plain string', () => {
    // Widening a field is a decision for whoever writes the second language, not a side effect of
    // saving a form. Every reader goes through serverTranslateContent, which takes either shape.
    expect(bilingualTextSchema.parse('Moderate: full refund 5 days prior.')).toBe(
      'Moderate: full refund 5 days prior.',
    );
  });

  it('adds a Romanian half to a property that had only a string', () => {
    expect(bilingualTextSchema.parse({ en: EN, ro: RO })).toEqual({ en: EN, ro: RO });
  });

  it('drops an untouched empty language rather than storing an empty string', () => {
    // A present-but-empty `ro` is worse than an absent one: serverTranslateContent falls back to
    // English on a missing key, but returns the empty string for a present one - a blank policy.
    expect(bilingualTextSchema.parse({ en: EN, ro: '' })).toEqual({ en: EN });
  });

  it('treats an all-blank object as nothing at all', () => {
    expect(bilingualTextSchema.parse({ en: '', ro: '' })).toBe('');
  });

  it('accepts an absent value', () => {
    expect(bilingualTextSchema.parse(undefined)).toBe('');
    expect(bilingualTextSchema.parse('')).toBe('');
  });

  it('sanitises every language, not just the first', () => {
    const out = bilingualTextSchema.parse({
      en: '<script>alert(1)</script>Free cancellation.',
      ro: '<script>alert(2)</script>Anulare gratuită.',
    }) as Record<string, string>;
    expect(out.en).not.toContain('<script>');
    expect(out.ro).not.toContain('<script>');
    expect(out.ro).toContain('Anulare gratuită.');
  });

  it('sanitises a plain string too', () => {
    const out = bilingualTextSchema.parse('<script>alert(1)</script>Policy.') as string;
    expect(out).not.toContain('<script>');
    expect(out).toContain('Policy.');
  });
});
