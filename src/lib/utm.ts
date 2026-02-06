/**
 * UTM parameter capture and attribution cookie management.
 * Implements first-touch + last-touch attribution model with 90-day cookie expiry.
 */

import type { BookingAttribution, TouchData } from '@/types';

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|opera m(ob|in)i/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Capture UTM parameters from URL and store as first-touch / last-touch cookies.
 * Call on every page load (client-side only).
 */
export function captureAndStoreAttribution() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const params: Record<string, string | null> = {};
  let hasUTM = false;

  for (const key of UTM_PARAMS) {
    const value = url.searchParams.get(key);
    params[key] = value;
    if (value) hasUTM = true;
  }

  const gclid = url.searchParams.get('gclid');
  const fbclid = url.searchParams.get('fbclid');
  const referrer = document.referrer || null;
  const landingPage = window.location.pathname + window.location.search;
  const timestamp = new Date().toISOString();

  // Store click IDs if present
  if (gclid) setCookie('attr_gclid', gclid);
  if (fbclid) setCookie('attr_fbclid', fbclid);

  // Store device type
  setCookie('attr_device', getDeviceType());

  // Only store touch data if we have UTM params, click IDs, or a referrer
  if (!hasUTM && !gclid && !fbclid && !referrer) return;

  // First-touch: only set if not already present
  if (!getCookie('attr_first_source')) {
    setCookie('attr_first_source', params.utm_source || '');
    setCookie('attr_first_medium', params.utm_medium || '');
    setCookie('attr_first_campaign', params.utm_campaign || '');
    setCookie('attr_first_term', params.utm_term || '');
    setCookie('attr_first_content', params.utm_content || '');
    setCookie('attr_first_referrer', referrer || '');
    setCookie('attr_first_landing', landingPage);
    setCookie('attr_first_timestamp', timestamp);
  }

  // Last-touch: always overwrite
  setCookie('attr_last_source', params.utm_source || '');
  setCookie('attr_last_medium', params.utm_medium || '');
  setCookie('attr_last_campaign', params.utm_campaign || '');
  setCookie('attr_last_term', params.utm_term || '');
  setCookie('attr_last_content', params.utm_content || '');
  setCookie('attr_last_referrer', referrer || '');
  setCookie('attr_last_landing', landingPage);
  setCookie('attr_last_timestamp', timestamp);
}

function readTouchFromCookies(prefix: 'first' | 'last'): TouchData | null {
  const source = getCookie(`attr_${prefix}_source`);
  const timestamp = getCookie(`attr_${prefix}_timestamp`);
  // If there's no timestamp cookie, there's no touch data
  if (!timestamp) return null;

  return {
    source: source || null,
    medium: getCookie(`attr_${prefix}_medium`) || null,
    campaign: getCookie(`attr_${prefix}_campaign`) || null,
    term: getCookie(`attr_${prefix}_term`) || null,
    content: getCookie(`attr_${prefix}_content`) || null,
    referrer: getCookie(`attr_${prefix}_referrer`) || null,
    landingPage: getCookie(`attr_${prefix}_landing`) || null,
    timestamp,
  };
}

/**
 * Read all attribution cookies and return a structured object (client-side).
 */
export function getAttributionFromCookies(): BookingAttribution {
  return {
    firstTouch: readTouchFromCookies('first'),
    lastTouch: readTouchFromCookies('last'),
    gclid: getCookie('attr_gclid') || null,
    fbclid: getCookie('attr_fbclid') || null,
    deviceType: (getCookie('attr_device') as BookingAttribution['deviceType']) || 'desktop',
  };
}

/**
 * Read attribution from Next.js server-side cookies.
 * Pass the result of `await cookies()` from a server action.
 */
export function getAttributionFromServerCookies(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): BookingAttribution {
  const get = (name: string) => cookieStore.get(name)?.value || null;

  function readTouch(prefix: 'first' | 'last'): TouchData | null {
    const timestamp = get(`attr_${prefix}_timestamp`);
    if (!timestamp) return null;
    return {
      source: get(`attr_${prefix}_source`),
      medium: get(`attr_${prefix}_medium`),
      campaign: get(`attr_${prefix}_campaign`),
      term: get(`attr_${prefix}_term`),
      content: get(`attr_${prefix}_content`),
      referrer: get(`attr_${prefix}_referrer`),
      landingPage: get(`attr_${prefix}_landing`),
      timestamp,
    };
  }

  return {
    firstTouch: readTouch('first'),
    lastTouch: readTouch('last'),
    gclid: get('attr_gclid'),
    fbclid: get('attr_fbclid'),
    deviceType: (get('attr_device') as BookingAttribution['deviceType']) || 'desktop',
  };
}
