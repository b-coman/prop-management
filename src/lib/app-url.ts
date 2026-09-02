/**
 * The app's own absolute base URL, for links that leave the app - emails above
 * all, where a relative path is meaningless.
 *
 * Why this exists: `NEXT_PUBLIC_APP_URL` is NOT provisioned on App Hosting (see
 * the note in `guide-token.ts`). Call sites that reached for it were therefore
 * producing one of two broken links:
 *   - `|| ''`                        -> "/unsubscribe?..."      (no host at all)
 *   - `|| 'https://rentalspot.com'`  -> a domain we do not own
 *   - no fallback at all             -> "undefined/review/..."
 *
 * `NEXT_PUBLIC_MAIN_APP_HOST` is the var that actually carries the host in
 * production. It is BUILD-availability, but `NEXT_PUBLIC_*` values are inlined
 * into the bundle at build time, so it is readable from server code at runtime.
 * Its stored value includes the protocol and a trailing slash, hence the
 * normalising below.
 *
 * Prefer a request-derived origin (`x-forwarded-host`) where one is available;
 * this is for the background paths - crons, webhooks - that have no request.
 */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_MAIN_APP_HOST || '';
  if (!raw) return '';
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}
