/**
 * no-track — a switch that keeps the owner's own visits out of GA4 and the Meta pixel.
 *
 * WHY. Every number this project acts on is small. Between 17 and 25 Aug the whole booking page saw
 * 33 people, and the campaign it is measuring produced 54 ViewContents on its best day. At that
 * scale a few rounds of testing on a phone are not noise — they are a visible fraction of the
 * sample, and they land in the same buckets the real visitors do. Worse, they are the WRONG kind of
 * visit: an owner checking a layout scrolls differently, never books, and leaves. Left in, they
 * quietly depress engagement and conversion and there is no way to tell them apart afterwards.
 *
 * WHY NOT THE USUAL ANSWERS.
 *   - GA4 internal-traffic filters key off IP. A phone on mobile data has no stable IP, and the
 *     filter does nothing about the Meta pixel, which is where the ad optimisation signal goes.
 *   - Declining consent stops the Meta pixel, but GA4 Consent Mode still sends cookieless pings, so
 *     the session is still counted. It also means never testing the consented path.
 *   - Browser extensions block one device, not the phone in your pocket.
 *
 * So the switch has to live in the site, cover BOTH destinations, and survive a page reload on any
 * device. A cookie set from a URL is the smallest thing that does all three.
 *
 * HOW TO USE IT. Visit any page with `?rs_test=1` once. The middleware sets a year-long cookie and
 * redirects to the clean URL; from then on that browser loads neither GTM nor the Meta pixel, and
 * is never asked for consent. `?rs_test=0` turns it back off. A small badge sits in the corner
 * while it is on, because a silent kill-switch is one you forget you left on — and then you spend
 * an afternoon wondering why your own visit never showed up in GA4.
 *
 * ADMIN IS ALWAYS EXCLUDED. `/admin/*` renders the same root layout as the guest site, so every
 * hour spent in the dashboard was firing pageviews into the same property being used to judge the
 * guest funnel. That is internal traffic by definition and needs no cookie to recognise.
 */

/** Cookie the browser carries once test mode is on. Server-readable only; nothing needs it in JS. */
export const NO_TRACK_COOKIE = 'rs_no_track';

/** Query parameter that flips it: `?rs_test=1` on, `?rs_test=0` off. */
export const NO_TRACK_PARAM = 'rs_test';

/** Header the middleware sets for paths that are internal whatever cookie the browser carries. */
export const NO_TRACK_HEADER = 'x-no-track';

/** A year. Long enough that the owner sets it once per device and forgets — hence the badge. */
export const NO_TRACK_MAX_AGE = 60 * 60 * 24 * 365;

/** Paths that are internal by nature, cookie or not. */
export function isInternalPath(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

/**
 * Should this request be kept out of analytics? Reads the two signals the middleware leaves behind.
 * Server-side only — it is what the root layout uses to decide whether the tags render at all,
 * which is stronger than loading them and asking them not to send.
 */
export function shouldSuppressTracking(
  cookieValue: string | undefined,
  headerValue: string | null
): boolean {
  return cookieValue === '1' || headerValue === '1';
}
