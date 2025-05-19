import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getLanguage } from './lib/server-language-utils';

// Deployment debug logging
let requestCount = 0;

export async function middleware(request: NextRequest) {
  requestCount++;
  const startTime = Date.now();
  
  try {
    console.log(`[Middleware] Request #${requestCount} - ${request.method} ${request.url}`);
    console.log(`[Middleware] Host: ${request.headers.get('host')}`);
    
    const url = request.nextUrl;
    const pathname = url.pathname;
    
    // CRITICAL: Skip health checks immediately
    if (pathname === '/api/health' || pathname === '/api/readiness') {
      console.log(`[Middleware] Health check - bypassing (${Date.now() - startTime}ms)`);
      return NextResponse.next();
    }
    
    // Skip all API routes during startup
    if (pathname.startsWith('/api/')) {
      console.log(`[Middleware] API route - bypassing (${Date.now() - startTime}ms)`);
      return NextResponse.next();
    }
    
    // Skip static assets
    if (pathname.startsWith('/_next/') || pathname.includes('.')) {
      console.log(`[Middleware] Static asset - bypassing (${Date.now() - startTime}ms)`);
      return NextResponse.next();
    }
    
    console.log(`[Middleware] Processing route: ${pathname} (${Date.now() - startTime}ms)`);
    
    // Minimal processing only
    const preferredLang = getLanguage(request);
    const response = NextResponse.next();
    response.headers.set('x-preferred-language', preferredLang);
    
    console.log(`[Middleware] Completed in ${Date.now() - startTime}ms`);
    return response;
    
  } catch (error) {
    console.error(`[Middleware] Error in request #${requestCount}:`, error);
    console.error(`[Middleware] Failed after ${Date.now() - startTime}ms`);
    // Always allow the request to continue
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Exclude all paths that shouldn't go through middleware
    '/((?!api/health|api/readiness|_next/static|_next/image|favicon.ico|.*\\..*|health|readiness).*)',
  ],
};