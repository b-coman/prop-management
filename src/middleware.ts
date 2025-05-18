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
    // Match all paths except for API routes, static files, etc.
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const hostname = request.headers.get('host') || '';

  // Handle admin routes with authentication check
  if (pathname.startsWith('/admin')) {
    return await handleAdminRoute(request);
  }

  // Language detection for guest-facing pages
  const preferredLang = detectPreferredLanguage(request);

  // Skip middleware for localhost and app's main domain
  const mainAppHost = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost';
  if (hostname.includes('localhost') || hostname === mainAppHost) {
    // For main app, only handle language redirects if needed
    return handleLanguageRouting(request, preferredLang);
  }

  // Simplified domain resolution without Firestore
  // In production, this would be a call to a compatible data store
  const propertySlug = DOMAIN_TO_PROPERTY_MAP[hostname] || null;

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
 * Handle admin routes with authentication check
 */
async function handleAdminRoute(request: NextRequest) {
  // Import Edge-compatible auth helpers
  const { checkAuth, createLoginRedirect, createUnauthorizedRedirect } = await import('./lib/auth-helpers-edge');

  // Check authentication
  const authResult = await checkAuth(request);

  // If not authenticated, redirect to login
  if (!authResult.authenticated) {
    return createLoginRedirect(request);
  }

  try {
    // User is authenticated, check for admin-specific permissions
    // Note: In a real production app, you would call an edge function to check if
    // the user has admin privileges. Since this is using Edge middleware,
    // we're keeping it simple.

    // For now, all authenticated users are allowed to access admin routes
    return NextResponse.next();
  } catch (error) {
    // Redirect to login on any error
    return createUnauthorizedRedirect(request);
  }
}