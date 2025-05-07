
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAIN_APP_HOST = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:9000'; // Use configured main host

export async function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;
  console.log(`[Middleware] Hostname: ${hostname}, Pathname: ${pathname}`);

  // Skip middleware for API routes, Next.js internals, and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    /\.(ico|png|jpg|jpeg|svg|txt|xml|webmanifest)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // If accessing via the MAIN app host, bypass domain resolution
  if (hostname === MAIN_APP_HOST) {
      console.log(`[Middleware] Accessing main host (${MAIN_APP_HOST}). Allowing request to proceed.`);
      // Let Next.js handle routing for paths like /, /properties/[slug], /admin, etc.
      return NextResponse.next();
  }

  // For custom domains (hostname !== MAIN_APP_HOST), try to resolve to a property
  console.log(`[Middleware] Custom domain detected (${hostname}). Attempting to resolve...`);
  try {
    const resolveApiUrl = new URL('/api/resolve-domain', request.url);
    resolveApiUrl.searchParams.set('domain', hostname);
    console.log(`[Middleware] Calling API: ${resolveApiUrl.toString()}`);

    const res = await fetch(resolveApiUrl.toString());

    if (res.ok) {
      const { slug, baseCurrency } = await res.json();
      if (slug) {
        console.log(`[Middleware] Domain ${hostname} resolved to slug: ${slug}. Rewriting to /properties/${slug}`);
        const rewriteUrl = new URL(`/properties/${slug}`, request.url);

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-resolved-property-slug', slug);
        requestHeaders.set('x-resolved-property-base-currency', baseCurrency || 'USD');

        return NextResponse.rewrite(rewriteUrl, {
          request: {
            headers: requestHeaders,
          },
        });
      } else {
           console.warn(`[Middleware] API resolved domain ${hostname} but returned no slug.`);
      }
    } else {
      const errorText = await res.text();
      console.warn(`[Middleware] API Error resolving domain ${hostname}: ${res.status} ${res.statusText} - ${errorText}`);
      // If domain resolution fails for a custom domain, redirect to main app or a 'not found' page?
      // For now, let it proceed, likely resulting in a 404 if no direct route matches.
    }
  } catch (error) {
    console.error(`[Middleware] Error fetching from resolve-domain API for ${hostname}:`, error);
  }

  console.log('[Middleware] No custom domain match or error in resolution, proceeding with default routing.');
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
