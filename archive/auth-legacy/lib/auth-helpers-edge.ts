// src/lib/auth-helpers-edge.ts
// Edge-compatible auth helpers for middleware

import { type NextRequest, NextResponse } from 'next/server';

export interface AuthResult {
  authenticated: boolean;
  user?: any; // Replace with your user type
  error?: string;
}

/**
 * Edge-compatible auth check
 * In Edge runtime, we can't use Firebase Admin SDK, so we need a different approach
 * This is a simplified version that checks for session cookies
 */
export async function checkAuth(request: NextRequest): Promise<AuthResult> {
  // In development, check for dev session cookie first
  if (process.env.NODE_ENV === 'development') {
    const devSessionCookie = request.cookies.get('dev-session');
    
    if (devSessionCookie?.value) {
      try {
        const devSessionData = JSON.parse(Buffer.from(devSessionCookie.value, 'base64').toString());
        console.log('[Auth Edge] Development session found in middleware:', devSessionData.uid);
        
        return { 
          authenticated: true,
          user: {
            uid: devSessionData.uid,
            email: devSessionData.email
          }
        };
      } catch (error) {
        console.error('[Auth Edge] Error parsing dev session in middleware:', error);
      }
    }
    
    // In development, if no dev session but no regular session either, 
    // return unauthenticated (don't bypass in middleware)
    console.log('[Auth Edge] No dev session found in middleware');
    return { authenticated: false };
  }
  
  // Production: check regular session cookie
  const sessionCookie = request.cookies.get('session');
  
  if (!sessionCookie?.value) {
    return { authenticated: false };
  }

  // In a real implementation, you'd verify the session token
  // For now, we'll just check if it exists
  // You could use a lightweight JWT library that works in Edge runtime
  return { authenticated: true };
}

/**
 * Create a redirect to the login page
 */
export function createLoginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Create an unauthorized redirect
 */
export function createUnauthorizedRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/unauthorized';
  return NextResponse.redirect(url);
}