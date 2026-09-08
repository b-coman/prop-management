/**
 * consent-suspension — a deliberate, TIME-LIMITED override that makes GA4 and the Meta Pixel behave
 * as if every visitor had granted marketing consent, and hides the cookie banner entirely.
 *
 * WHY IT EXISTS. The consent gate is the master valve on every number this project acts on. At a 53%
 * accept rate roughly half of all paid traffic is invisible to GA4 and the pixel, which means the
 * funnel is being judged on a sample rather than a census, and the pixel's audience pool fills at
 * half speed. The owner asked to run without it for a week or two to measure the real shape of the
 * funnel, and to learn from a complete picture before deciding what to change.
 *
 * WHY IT IS A DATE AND NOT A BOOLEAN. This is the one switch in this codebase with a legal clock on
 * it: Prahova is in Romania, so ePrivacy and GDPR require prior consent for analytics and marketing
 * tags, and Meta's Business Tools Terms put that obligation on the advertiser. A boolean left on by
 * accident is an open-ended exposure; a date cannot be. The intent was always "a week or two", so
 * the intent is what gets encoded — the banner comes back on its own, with no deploy and nobody
 * having to remember. The same reasoning as the `rs_test` badge in the root layout, one step
 * further: a kill-switch you cannot see is one you forget you left on, so this one expires itself.
 *
 * HOW TO USE IT. Set `NEXT_PUBLIC_CONSENT_SUSPENDED_UNTIL` to a plain `YYYY-MM-DD` in apphosting.yaml
 * and deploy. To end it early, clear the variable (or set a past date) and deploy. To let it lapse,
 * do nothing. The value is read at RUNTIME on every render, so expiry needs no deploy even though
 * the variable itself is inlined at build time.
 *
 * WHAT IT DOES NOT DO. It does not touch the `rs_test` no-track switch (the owner's own visits stay
 * excluded), it does not change the server-side Conversions API, and it does not alter what is
 * collected — only whether the visitor is asked first.
 */

/** `YYYY-MM-DD`. Absent or empty means the consent banner behaves normally. */
const RAW = process.env.NEXT_PUBLIC_CONSENT_SUSPENDED_UNTIL;

/**
 * Is the consent gate currently suspended?
 *
 * Fails CLOSED on anything it does not understand — a malformed date, a missing value, a date in the
 * past all mean "ask for consent". The safe default for a compliance control is the compliant one,
 * so a typo can only ever restore the banner, never silently remove it.
 *
 * `now` is injectable so the expiry is testable without waiting for a calendar.
 */
export function isConsentSuspended(now: Date = new Date()): boolean {
  if (!RAW) return false;
  const value = RAW.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Expire at the END of the named day, in UTC. Cloud Run is UTC and Romania is UTC+2/+3, so the
  // banner returns during the small hours of the following morning local time — never mid-afternoon.
  const expiresAt = Date.parse(`${value}T23:59:59Z`);
  if (Number.isNaN(expiresAt)) return false;
  return now.getTime() < expiresAt;
}

/** The configured end date, for logging and for telling the operator when it lapses. Null if unset. */
export function consentSuspensionEndsOn(): string | null {
  const value = RAW?.trim();
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
