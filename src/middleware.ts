// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

// Edge-compatible domain resolution
// This is a simplified version that uses a map instead of Firestore
// In production, you would use a KV store or similar Edge-compatible storage
const DOMAIN_TO_PROPERTY_MAP: Record<string, string> = {
  // Production custom domains
  'prahova-chalet.ro': 'prahova-mountain-chalet',
  'www.prahova-chalet.ro': 'prahova-mountain-chalet',
  // Add more property domains here as needed:
  // 'coltei-apartment.ro': 'coltei-apartment-bucharest',
};

export const config = {
  matcher: [
    // Match all paths except for API routes, static files, health checks, etc.
    '/((?!api|_next/static|_next/image|favicon.ico|locales|health|readiness).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const hostname = request.headers.get('host') || '';

  // Skip middleware for health check endpoints
  if (pathname === '/api/health' || pathname === '/api/readiness') {
    return NextResponse.next();
  }

  // Admin routes - let the pages handle auth (simpler, avoids loops)
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Skip if path already targets the internal property route (prevents double-rewrite)
  if (pathname.startsWith('/properties/')) {
    return NextResponse.next();
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

  // Rewrite the URL to the correct property page
  // Handle different path patterns for multi-page structure
  if (pathWithoutLang === '/' || pathWithoutLang === '') {
    // Rewrite to the property homepage
    url.pathname = `/properties/${propertySlug}${language !== DEFAULT_LANGUAGE ? `/${language}` : ''}`;
  } else if (
    pathWithoutLang.startsWith('/details') ||
    pathWithoutLang.startsWith('/location') ||
    pathWithoutLang.startsWith('/gallery') ||
    pathWithoutLang.startsWith('/booking')
  ) {
    // Handle known page types
    const pageType = pathWithoutLang.split('/')[1];
    url.pathname = `/properties/${propertySlug}${language !== DEFAULT_LANGUAGE ? `/${language}` : ''}/${pageType}`;
  } else {
    // For any other path, maintain it but within the property context
    url.pathname = `/properties/${propertySlug}${language !== DEFAULT_LANGUAGE ? `/${language}` : ''}${pathWithoutLang}`;
  }

  // Set language cookie if different from current
  const response = NextResponse.rewrite(url);
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
  
  // Check if path already includes a language
  for (const lang of SUPPORTED_LANGUAGES) {
    if (pathname.startsWith(`/${lang}/`) || pathname === `/${lang}`) {
      return NextResponse.next();
    }
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

  return NextResponse.next();
}

// Note: Admin route auth is handled by SimpleAdminAuth component in admin layout
// This keeps middleware simple and avoids redirect loops