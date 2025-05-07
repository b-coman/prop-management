
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAIN_APP_HOST = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost'; // Ensure this matches your production main host

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
    console.log(`[Middleware] Skipping for internal/API/static path: ${pathname}`);
    return NextResponse.next();
  }

  // --- Bypass domain resolution for localhost/development ---
  // Check if hostname is localhost or 127.0.0.1 (optionally check for specific dev ports if needed)
  const isDevelopmentHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('localhost:') || hostname.startsWith('127.0.0.1:');
  if (isDevelopmentHost) {
      console.log(`[Middleware] Development host (${hostname}) detected. Bypassing custom domain resolution.`);
      // Let Next.js handle routing for paths like /, /properties/[slug], /admin, etc. on localhost
      return NextResponse.next();
  }

  // If accessing via the MAIN app host (in production), also bypass domain resolution
  // Remove port for comparison if MAIN_APP_HOST doesn't include it
  const requestHostnameWithoutPort = hostname.split(':')[0];
  const mainAppHostnameWithoutPort = MAIN_APP_HOST.split(':')[0];
  if (requestHostnameWithoutPort === mainAppHostnameWithoutPort) {
      console.log(`[Middleware] Accessing main host (${hostname}). Allowing request to proceed.`);
      // Let Next.js handle routing for paths like /, /properties/[slug], /admin, etc.
      return NextResponse.next();
  }


  // --- For custom domains (hostname !== MAIN_APP_HOST and not localhost), try to resolve ---
  console.log(`[Middleware] Custom domain detected (${hostname}). Attempting to resolve...`);
  try {
    const resolveApiUrl = new URL('/api/resolve-domain', request.url);
    resolveApiUrl.searchParams.set('domain', hostname);
    console.log(`[Middleware] Calling API: ${resolveApiUrl.toString()}`);

    const res = await fetch(resolveApiUrl.toString());

    if (res.ok) {
      const data = await res.json();
      const slug = data?.slug; // Use optional chaining
      const baseCurrency = data?.baseCurrency; // Use optional chaining

      if (slug) {
        console.log(`[Middleware] Domain ${hostname} resolved to slug: ${slug}. Rewriting to /properties/${slug}`);
        const rewriteUrl = new URL(`/properties/${slug}${pathname}`, request.url); // Preserve original pathname

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-resolved-property-slug', slug);
        requestHeaders.set('x-resolved-property-base-currency', baseCurrency || 'USD'); // Default if missing

        return NextResponse.rewrite(rewriteUrl, {
          request: {
            headers: requestHeaders,
          },
        });
      } else {
           console.warn(`[Middleware] API resolved domain ${hostname} but returned no slug in JSON.`);
      }
    } else {
      const errorText = await res.text();
      console.warn(`[Middleware] API Error resolving domain ${hostname}: ${res.status} ${res.statusText} - ${errorText}`);
      // If domain resolution fails for a custom domain, proceed - might lead to 404 if no direct route matches.
      // Consider redirecting to a specific "domain not found" page or the main app host.
    }
  } catch (error) {
    console.error(`[Middleware] Error fetching from resolve-domain API for ${hostname}:`, error);
  }

  console.log(`[Middleware] No custom domain rewrite performed for ${hostname}, proceeding with default routing for path: ${pathname}`);
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
