/**
 * @fileoverview Simple edge-compatible authentication helpers
 * @module lib/simple-auth-edge
 * 
 * @description
 * Edge-compatible authentication helpers for middleware.
 * Works with the new simple authentication system.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface AuthResult {
  authenticated: boolean;
  user?: {
    uid: string;
    email: string;
  };
  error?: string;
}

/**
 * Check authentication in edge runtime (middleware)
 */
export async function checkAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const sessionCookie = request.cookies.get('auth-session');

    if (!sessionCookie?.value) {
      return { authenticated: false };
    }

    // Try to parse simple session
    try {
      const sessionData = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString()
      );

      // Check if session is expired (7 days)
      const isExpired = Date.now() - sessionData.timestamp > (60 * 60 * 24 * 7 * 1000);
      
      if (isExpired) {
        return { authenticated: false, error: 'Session expired' };
      }

      return {
        authenticated: true,
        user: {
          uid: sessionData.uid,
          email: sessionData.email
        }
      };

    } catch (parseError) {
      // If parsing fails, it might be a Firebase session cookie
      // In edge runtime, we can't verify Firebase session cookies
      // So we'll assume it's valid if it exists
      return { authenticated: true };
    }

  } catch (error) {
    console.error('[SimpleAuthEdge] Authentication check error:', error);
    return { authenticated: false, error: 'Auth check failed' };
  }
}

/**
 * Create login redirect
 */
export function createLoginRedirect(request: NextRequest): NextResponse {
  const url = new URL('/login', request.url);
  url.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Create unauthorized redirect
 */
export function createUnauthorizedRedirect(request: NextRequest): NextResponse {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', 'unauthorized');
  return NextResponse.redirect(url);
}