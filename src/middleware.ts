// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { DOMAIN_TO_PROPERTY_MAP } from '@/lib/domain-map';

export const config = {
  matcher: [
    // Match all paths except for API routes, static files, public assets, health checks, SEO files, etc.
    '/((?!api|_next/static|_next/image|images|favicon.ico|locales|health|readiness|sitemap\\.xml|robots\\.txt|llms\\.txt).*)',
  ],
};

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

  // Admin routes - let the pages handle auth (simpler, avoids loops)
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Skip if path already targets the internal property route (prevents double-rewrite)
  // But still detect language from path and pass as header for SSR lang attribute
  if (pathname.startsWith('/properties/')) {
    const segments = pathname.split('/').filter(Boolean);
    // Language appears after slug: /properties/{slug}/{lang}/...
    const langFromPath = segments.length >= 3 && SUPPORTED_LANGUAGES.includes(segments[2]) ? segments[2] : DEFAULT_LANGUAGE;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-language', langFromPath);
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

  // Pass detected language as request header for SSR lang attribute
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-language', language);

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