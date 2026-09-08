/**
 * The safety property of the consent suspension is that it ENDS BY ITSELF. Everything else about it
 * is a convenience; the expiry is the part that keeps a legal control from being left off by
 * accident, so it is the part that gets tested — including every malformed input, each of which must
 * fail CLOSED (banner shown, consent asked).
 *
 * The module reads the env var at import time, so each case re-imports it under `jest.isolateModules`
 * with the variable set. That is the same thing a fresh Cloud Run instance does.
 */
describe('isConsentSuspended', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_CONSENT_SUSPENDED_UNTIL;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_CONSENT_SUSPENDED_UNTIL;
    else process.env.NEXT_PUBLIC_CONSENT_SUSPENDED_UNTIL = ORIGINAL;
  });

  const withValue = <T,>(value: string | undefined, fn: (m: typeof import('../consent-suspension')) => T): T => {
    if (value === undefined) delete process.env.NEXT_PUBLIC_CONSENT_SUSPENDED_UNTIL;
    else process.env.NEXT_PUBLIC_CONSENT_SUSPENDED_UNTIL = value;
    let out!: T;
    jest.isolateModules(() => {
      out = fn(require('../consent-suspension'));
    });
    return out;
  };

  it('is suspended before the end date', () => {
    expect(withValue('2026-09-23', (m) => m.isConsentSuspended(new Date('2026-09-09T10:00:00Z')))).toBe(true);
  });

  it('is still suspended during the final day — the date is inclusive', () => {
    expect(withValue('2026-09-23', (m) => m.isConsentSuspended(new Date('2026-09-23T22:00:00Z')))).toBe(true);
  });

  it('EXPIRES once the final day is over, with no code change', () => {
    expect(withValue('2026-09-23', (m) => m.isConsentSuspended(new Date('2026-09-24T00:00:01Z')))).toBe(false);
  });

  it('is not suspended long after the date', () => {
    expect(withValue('2026-09-23', (m) => m.isConsentSuspended(new Date('2027-01-01T00:00:00Z')))).toBe(false);
  });

  // Everything below must FAIL CLOSED: a typo can only ever restore the banner, never remove it.
  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['a boolean', 'true'],
    ['a US-format date', '09/23/2026'],
    ['an ISO datetime rather than a date', '2026-09-23T00:00:00Z'],
    ['a past date', '2020-01-01'],
    ['nonsense', 'next week'],
    ['a partial date', '2026-09'],
  ])('fails closed when the value is %s', (_label, value) => {
    expect(withValue(value, (m) => m.isConsentSuspended(new Date('2026-09-09T10:00:00Z')))).toBe(false);
  });

  it('reports the end date for logging, and null when unusable', () => {
    expect(withValue('2026-09-23', (m) => m.consentSuspensionEndsOn())).toBe('2026-09-23');
    expect(withValue('rubbish', (m) => m.consentSuspensionEndsOn())).toBeNull();
    expect(withValue(undefined, (m) => m.consentSuspensionEndsOn())).toBeNull();
  });
});
