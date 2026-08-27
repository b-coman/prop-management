// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { NO_TRACK_COOKIE, NO_TRACK_PARAM, NO_TRACK_HEADER, NO_TRACK_MAX_AGE, isInternalPath } from '@/lib/no-track';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { DOMAIN_TO_PROPERTY_MAP } from '@/lib/domain-map';

export const config = {
  matcher: [
    // Match all paths except for API routes, static files, public assets, health checks, SEO files, etc.
    '/((?!api|_next/static|_next/image|images|favicon.ico|locales|health|readiness|sitemap\\.xml|robots\\.txt|llms\\.txt).*)',
  ],
};

/**
 * Guess-rate limit for the guest guide.
 *
 * The guide is a public URL whose only protection is an unguessable token, and
 * a wrong guess costs three Firestore reads. Deliberately implemented inline
 * rather than reusing lib/rate-limiter: middleware runs on the edge runtime,
 * where that module's logger cannot write to stdout.
 *
 * In-memory, so the limit is per instance rather than global - the same caveat
 * the existing limiter documents. It turns unbounded guessing into a crawl,
 * which is all it needs to do.
 */
const GUIDE_WINDOW_MS = 60_000;
const GUIDE_MAX = 30;
const guideHits = new Map<string, { count: number; resetAt: number }>();

function guideRateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();

  // Sweep expired entries so the map cannot grow without bound.
  if (guideHits.size > 5000) {
    for (const [k, v] of guideHits) if (v.resetAt < now) guideHits.delete(k);
  }

  const entry = guideHits.get(ip);
  if (!entry || entry.resetAt < now) {
    guideHits.set(ip, { count: 1, resetAt: now + GUIDE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > GUIDE_MAX;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Use x-forwarded-host to get the original client-facing domain.
  // Firebase App Hosting proxies through CDN, so 'host' header is the
  // internal Cloud Run URL, while x-forwarded-host is the custom domain.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostHeader = request.headers.get('host') || '';
  const hostname = forwardedHost || hostHeader;

  // Skip middleware for health check endpoints
  if (pathname === '/api/health' || pathname === '/api/readiness') {
    return NextResponse.next();
  }

  // ── Keep the owner's own visits out of the numbers ──────────────────────────────────────────
  //
  // `?rs_test=1` sets a year-long cookie and bounces to the clean URL; `?rs_test=0` clears it. The
  // root layout reads the cookie and renders NO GTM and NO Meta pixel, which is stronger than
  // loading them and asking them not to send. See src/lib/no-track.ts for why the usual answers
  // (GA4 IP filters, declining consent, browser extensions) do not cover a phone on mobile data.
  //
  // The redirect is built from x-forwarded-host, not `request.url`: App Hosting sets `host` to the
  // internal Cloud Run URL, so redirecting off nextUrl would bounce the visitor out of the custom
  // domain entirely.
  const trackParam = url.searchParams.get(NO_TRACK_PARAM);
  if (trackParam === '1' || trackParam === '0') {
    url.searchParams.delete(NO_TRACK_PARAM);
    // Build the destination from the HOST HEADER, not from nextUrl. Two reasons, both found by
    // testing: nextUrl does not carry the port (locally this redirected to http://localhost/ro and
    // landed on a Chrome error page), and on App Hosting `host` is the internal Cloud Run URL, so
    // trusting it would bounce a visitor off the custom domain. hostHeader keeps the port for dev;
    // forwardedHost is the real client-facing domain in production.
    const targetHost = forwardedHost || hostHeader;
    const proto =
      request.headers.get('x-forwarded-proto') ??
      (targetHost.startsWith('localhost') || targetHost.startsWith('127.0.0.1') ? 'http' : 'https');
    const dest = new URL(`${url.pathname}${url.search}`, `${proto}://${targetHost}`);
    const res = NextResponse.redirect(dest);
    if (trackParam === '1') {
      res.cookies.set(NO_TRACK_COOKIE, '1', {
        maxAge: NO_TRACK_MAX_AGE,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: proto === 'https',
      });
    } else {
      res.cookies.delete(NO_TRACK_COOKIE);
    }
    return res;
  }

  // The admin dashboard renders the same root layout as the guest site, so every hour spent in it
  // was firing pageviews into the property used to judge the guest funnel. Internal by definition.
  if (isInternalPath(pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(NO_TRACK_HEADER, '1');
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Guest guide: throttle token guessing before it reaches Firestore.
  if (pathname.startsWith('/g/') || pathname.startsWith('/guide/')) {
    if (guideRateLimited(request)) {
      return new NextResponse('Too many requests', {
        status: 429,
        headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.next();
  }

  // Campaign landing pages carry their language the same way property pages do, one segment later:
  // /lp/{campaign}/{lang}. Nothing here recognised that, so `x-language` was 'en' for EVERY paid
  // landing - which is how a Romanian visitor arriving from a Romanian ad got <html lang="en"> and,
  // more expensively, an English cookie notice while the root provider waited on a client fetch.
  // The page itself already compensated for the lang attribute; the root layout could not.
  if (pathname.startsWith('/lp/')) {
    const segments = pathname.split('/').filter(Boolean);
    const langFromPath = segments.length >= 3 && SUPPORTED_LANGUAGES.includes(segments[2]) ? segments[2] : DEFAULT_LANGUAGE;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-language', langFromPath);
    // The property is NOT in a landing page's path (/lp/{campaign}/{lang}), so unlike the
    // /properties/ branch below we cannot set x-property-slug here. Expose the campaign instead and
    // let the root layout resolve campaign -> property -> pixel. Without this the layout resolved no
    // property, MetaPixel rendered null, and `fbq` never existed on the ONLY pages the ads point at:
    // every ViewContent landed on a page with no pixel, and paid traffic built no audience at all.
    if (segments[1]) requestHeaders.set('x-campaign-slug', segments[1]);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Skip if path already targets the internal property route (prevents double-rewrite)
  // But still detect language from path and pass as header for SSR lang attribute
  if (pathname.startsWith('/properties/')) {
    const segments = pathname.split('/').filter(Boolean);
    // Language appears after slug: /properties/{slug}/{lang}/...
    const langFromPath = segments.length >= 3 && SUPPORTED_LANGUAGES.includes(segments[2]) ? segments[2] : DEFAULT_LANGUAGE;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-language', langFromPath);
    // Expose the property slug so SSR can resolve per-property config (e.g. the
    // Meta pixel) even when the property has no custom domain (segments[1]=slug).
    if (segments[1]) requestHeaders.set('x-property-slug', segments[1]);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Language detection for guest-facing pages
  const preferredLang = detectPreferredLanguage(request);

  // Skip middleware for localhost and app's main domain
  const mainAppHost = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost';
  if (hostname.includes('localhost') || hostname === mainAppHost || hostname.includes('0.0.0.0')) {
    // For main app, only handle language redirects if needed
    return handleLanguageRouting(request, preferredLang);
  }

  // Try to resolve domain - check static map first, then dynamic resolution
  let propertySlug = DOMAIN_TO_PROPERTY_MAP[hostname] || null;

  // Dynamic resolution via Firestore for custom domains not in the static map
  if (!propertySlug && hostname && !hostname.includes('0.0.0.0')) {
    try {
      const resolveUrl = `${request.nextUrl.protocol}//${hostname}/api/resolve-domain?domain=${encodeURIComponent(hostname)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      try {
        const response = await fetch(resolveUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'RentalSpot-Middleware/1.0',
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          propertySlug = data.slug;
        }
      } catch (error) {
        // Silently fail and continue — custom domain will fall through to root page
        console.error(`[Middleware] Failed to resolve domain ${hostname}:`, error);
      }
    } catch (error) {
      console.error(`[Middleware] Error in domain resolution:`, error);
    }
  }

  if (!propertySlug) {
    // If no property found for this domain, continue normally
    return NextResponse.next();
  }

  // Extract language from path if present
  let language = DEFAULT_LANGUAGE;
  let pathWithoutLang = pathname;

  // Check if path starts with a supported language
  for (const lang of SUPPORTED_LANGUAGES) {
    if (pathname.startsWith(`/${lang}/`) || pathname === `/${lang}`) {
      language = lang;
      pathWithoutLang = pathname.slice(lang.length + 1) || '/';
      break;
    }
  }

  // Build the rewrite target path
  // Rule: single-segment paths are property template pages (rewrite to /properties/slug/...),
  // multi-segment paths are global app routes like /booking/check/slug (pass through).
  const pathSegments = pathWithoutLang.split('/').filter(Boolean);
  const langSegment = language !== DEFAULT_LANGUAGE ? `/${language}` : '';

  let rewritePath: string;
  if (pathSegments.length <= 1) {
    // Root or single-segment: property template page
    // e.g., / → /properties/slug, /details → /properties/slug/details
    rewritePath = pathSegments.length === 0
      ? `/properties/${propertySlug}${langSegment}`
      : `/properties/${propertySlug}${langSegment}/${pathSegments[0]}`;
  } else {
    // Multi-segment: global app route (booking system, reviews, etc.)
    // e.g., /booking/check/slug → pass through to Next.js router
    // Strip language prefix if present (already done in pathWithoutLang)
    rewritePath = pathWithoutLang;
  }

  // Rewrite using explicit URL construction
  const rewriteUrl = new URL(rewritePath, request.url);
  rewriteUrl.search = url.search; // preserve original query parameters

  // Pass detected language + resolved property slug as request headers, so SSR
  // (e.g. the root layout) can resolve per-property config like the Meta pixel.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-language', language);
  requestHeaders.set('x-property-slug', propertySlug);

  const response = NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  });
  response.cookies.set('preferredLanguage', language, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365 // 1 year
  });

  return response;
}

/**
 * Detect preferred language from request
 */
function detectPreferredLanguage(request: NextRequest): string {
  // Check cookie first
  const cookieLang = request.cookies.get('preferredLanguage')?.value;
  if (cookieLang && SUPPORTED_LANGUAGES.includes(cookieLang)) {
    return cookieLang;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    // Parse the header and find first supported language
    const languages = acceptLanguage.split(',').map(lang => {
      const [code] = lang.trim().split(';');
      return code.toLowerCase().split('-')[0];
    });

    for (const lang of languages) {
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return lang;
      }
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Handle language-based routing for main app
 */
function handleLanguageRouting(request: NextRequest, preferredLang: string): NextResponse {
  const pathname = request.nextUrl.pathname;

  // Detect language from path for SSR lang attribute
  let detectedLang = DEFAULT_LANGUAGE;
  for (const lang of SUPPORTED_LANGUAGES) {
    if (pathname.startsWith(`/${lang}/`) || pathname === `/${lang}`) {
      detectedLang = lang;
      break;
    }
  }
  // Also check /properties/{slug}/{lang} pattern
  if (detectedLang === DEFAULT_LANGUAGE && pathname.startsWith('/properties/')) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && SUPPORTED_LANGUAGES.includes(segments[2])) {
      detectedLang = segments[2];
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-language', detectedLang);

  // Check if path already includes a language
  if (detectedLang !== DEFAULT_LANGUAGE) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // For property pages, check if we should redirect to preferred language
  if (pathname.startsWith('/properties/') && preferredLang !== DEFAULT_LANGUAGE) {
    const segments = pathname.split('/');

    // Insert language after property slug if not already present
    if (segments.length >= 3 && !SUPPORTED_LANGUAGES.includes(segments[3])) {
      segments.splice(3, 0, preferredLang);
      const newPathname = segments.join('/');

      if (newPathname !== pathname) {
        const url = request.nextUrl.clone();
        url.pathname = newPathname;
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Note: Admin route auth is handled by SimpleAdminAuth component in admin layout
// This keeps middleware simple and avoids redirect loops