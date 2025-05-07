// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAIN_APP_HOST = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:9002'; // Fallback for local dev

export async function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;
  console.log(`[Middleware] Hostname: ${hostname}, Pathname: ${pathname}`);

  // Skip middleware for API routes, Next.js internals, and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') || // Common folder for static assets
    /\.(ico|png|jpg|jpeg|svg|txt|xml|webmanifest)$/.test(pathname) // File extensions
  ) {
    // console.log('[Middleware] Skipping for API, Next.js internal, or static file.');
    return NextResponse.next();
  }

  // If accessing via the main app host and path is /properties/[slug], let it pass
  if (hostname === MAIN_APP_HOST && pathname.startsWith('/properties/')) {
    // console.log('[Middleware] Accessing main host with /properties path. Allowing.');
    return NextResponse.next();
  }

  // If accessing via the main app host and it's not the root or /properties, allow (e.g., for /admin, /login)
  if (hostname === MAIN_APP_HOST && pathname !== '/' && !pathname.startsWith('/properties/')) {
      // console.log(`[Middleware] Accessing main host with other path (${pathname}). Allowing.`);
      return NextResponse.next();
  }


  // For custom domains or root path on main host, try to resolve to a property
  if (hostname !== MAIN_APP_HOST || pathname === '/') {
    // console.log(`[Middleware] Custom domain or root path detected. Calling API: ${request.nextUrl.protocol}//${MAIN_APP_HOST}/api/resolve-domain?domain=${hostname}`);
    try {
      // Use the request's own protocol and host to build the API URL for resolving
      // This avoids issues if the middleware runs in a different environment than the API
      const resolveApiUrl = new URL('/api/resolve-domain', request.url);
      resolveApiUrl.searchParams.set('domain', hostname);
      
      // console.log(`[Middleware] Calling API: ${resolveApiUrl.toString()}`);


      const res = await fetch(resolveApiUrl.toString());

      if (res.ok) {
        const { slug, baseCurrency } = await res.json();
        if (slug) {
          console.log(`[Middleware] Domain ${hostname} resolved to slug: ${slug}, baseCurrency: ${baseCurrency}. Rewriting to /properties/${slug}`);
          const rewriteUrl = new URL(`/properties/${slug}`, request.url);
          
          // Add resolved property info to headers for use in page components
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-resolved-property-slug', slug);
          requestHeaders.set('x-resolved-property-base-currency', baseCurrency || 'USD'); // Default to USD if not provided

          return NextResponse.rewrite(rewriteUrl, {
            request: {
              headers: requestHeaders,
            },
          });
        }
      } else {
        const errorText = await res.text();
        console.warn(`[Middleware] API Error resolving domain ${hostname}: ${res.status} ${res.statusText} - ${errorText}`);
        // If domain resolution fails, and it's not the main app host,
        // potentially redirect to a 'domain not found' page or the main app.
        // For now, we let it proceed, which might result in a 404 if no direct route matches.
        // If it IS the main app host (meaning we tried to resolve from root path), and resolution failed, let Next handle it (likely shows homepage).
      }
    } catch (error) {
      console.error(`[Middleware] Error fetching from resolve-domain API for ${hostname}:`, error);
    }
  }
  // console.log('[Middleware] No specific rule matched or error in resolution, proceeding with default routing.');
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};