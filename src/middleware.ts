// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

// Edge-compatible domain resolution
// This is a simplified version that uses a map instead of Firestore
// In production, you would use a KV store or similar Edge-compatible storage
const DOMAIN_TO_PROPERTY_MAP: Record<string, string> = {
  // Example mappings - update with real domains
  'mountain-chalet.example.com': 'prahova-mountain-chalet',
  'apartment-bucharest.example.com': 'coltei-apartment-bucharest'
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

  // Handle admin routes with authentication check
  if (pathname.startsWith('/admin')) {
    return await handleAdminRoute(request);
  }

  // Language detection for guest-facing pages
  const preferredLang = detectPreferredLanguage(request);

  // Skip middleware for localhost and app's main domain
  const mainAppHost = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost';
  if (hostname.includes('localhost') || hostname === mainAppHost || hostname.includes('0.0.0.0')) {
    // For main app, only handle language redirects if needed
    return handleLanguageRouting(request, preferredLang);
  }

  // Try to resolve domain - but fail gracefully
  let propertySlug = DOMAIN_TO_PROPERTY_MAP[hostname] || null;
  
  // If we need dynamic resolution, do it safely
  if (!propertySlug && process.env.USE_DYNAMIC_DOMAIN_RESOLUTION === 'true') {
    try {
      // Only attempt fetch if we have a proper hostname
      if (hostname && !hostname.includes('0.0.0.0')) {
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
          // Silently fail and continue
          console.error(`[Middleware] Failed to resolve domain ${hostname}:`, error);
        }
      }
    } catch (error) {
      // Silently fail and continue
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

/**
 * Check if email is a super admin (edge-compatible - reads env var directly)
 */
function isEnvSuperAdmin(email: string): boolean {
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS
    ?.split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0) || [];
  return superAdminEmails.includes(email.toLowerCase());
}

/**
 * Parse session cookie to extract user info (edge-compatible)
 */
function parseSessionCookie(cookieValue: string): { uid: string; email: string } | null {
  try {
    // Try to parse as base64 simple session
    const sessionData = JSON.parse(
      Buffer.from(cookieValue, 'base64').toString()
    );

    // Check if session is expired (7 days)
    const isExpired = Date.now() - sessionData.timestamp > (60 * 60 * 24 * 7 * 1000);
    if (isExpired) return null;

    return {
      uid: sessionData.uid,
      email: sessionData.email
    };
  } catch {
    // Not a simple session - could be Firebase session cookie
    // We can't verify Firebase cookies in edge runtime
    return null;
  }
}

/**
 * Handle admin routes with authentication and authorization check
 */
async function handleAdminRoute(request: NextRequest) {
  const { checkAuth, createLoginRedirect, createUnauthorizedRedirect } = await import('./lib/simple-auth-edge');

  // First, check basic authentication
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) {
    return createLoginRedirect(request);
  }

  // Try to get user email from session
  const sessionCookie = request.cookies.get('auth-session');
  if (!sessionCookie?.value) {
    return createLoginRedirect(request);
  }

  const sessionUser = parseSessionCookie(sessionCookie.value);

  // Debug logging
  const envValue = process.env.SUPER_ADMIN_EMAILS;
  console.log('[Middleware] Auth check:', {
    hasSession: !!sessionCookie?.value,
    sessionEmail: sessionUser?.email || 'none',
    envVarSet: !!envValue,
    isSuperAdmin: sessionUser?.email ? isEnvSuperAdmin(sessionUser.email) : false
  });

  // Fast path: If user is in SUPER_ADMIN_EMAILS, allow access immediately
  // This avoids an API call for super admins
  if (sessionUser?.email && isEnvSuperAdmin(sessionUser.email)) {
    console.log('[Middleware] Fast path: super admin access granted');
    return NextResponse.next();
  }

  // For other users, we need to check the database via API
  // Call the check-admin API endpoint (runs in Node.js runtime)
  try {
    const baseUrl = request.nextUrl.origin;
    const checkAdminUrl = new URL('/api/auth/check-admin', baseUrl);

    // Forward the session cookie
    const response = await fetch(checkAdminUrl, {
      method: 'GET',
      headers: {
        'Cookie': `auth-session=${sessionCookie.value}`,
      },
    });

    if (!response.ok) {
      console.error('[Middleware] check-admin API returned error:', response.status);
      return createUnauthorizedRedirect(request);
    }

    const data = await response.json();

    if (!data.authorized) {
      console.warn('[Middleware] User not authorized:', data.error);
      return createUnauthorizedRedirect(request);
    }

    // User is authorized - allow access
    return NextResponse.next();

  } catch (error) {
    console.error('[Middleware] Error checking admin status:', error);

    // Graceful fallback: allow access but server actions will do final check
    // This prevents middleware failures from blocking all admin access
    console.warn('[Middleware] Falling back to server-side auth check');
    return NextResponse.next();
  }
}