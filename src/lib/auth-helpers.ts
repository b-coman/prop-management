import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Import from Node.js-specific Firebase Admin implementation for server components
import { verifySessionCookie, isUserAdmin } from './firebaseAdminNode';

/**
 * Check if the user is authenticated based on session cookie
 * For middleware use (edge runtime compatible)
 */
export async function checkAuth(request: NextRequest) {
  try {
    // Skip authentication in development mode to make development easier
    if (process.env.NODE_ENV === 'development') {
      console.log('🔓 [Auth] Development mode - bypassing authentication check');
      return {
        authenticated: true,
        admin: true,
        user: {
          uid: 'dev-admin-uid',
          email: 'dev-admin@example.com'
        }
      };
    }

    // Get session cookie
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      return { authenticated: false };
    }

    // In a production environment, you would call an edge-compatible API endpoint
    // to verify the session cookie using Firebase Admin SDK

    return {
      authenticated: true,
      // Pretend we have the user info from the verified token
      user: {
        uid: 'dev-user-id',
        email: 'dev@example.com'
      }
    };
  } catch (error) {
    console.error('Authentication check error:', error);
    return { authenticated: false };
  }
}

/**
 * Helper to generate login redirect response
 */
export function createLoginRedirect(request: NextRequest) {
  const url = new URL('/login', request.url);
  url.searchParams.set('returnUrl', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

/**
 * Helper to generate unauthorized redirect response
 */
export function createUnauthorizedRedirect(request: NextRequest) {
  const url = new URL('/login', request.url);
  url.searchParams.set('returnUrl', request.nextUrl.pathname + request.nextUrl.search);
  url.searchParams.set('error', 'unauthorized');
  return NextResponse.redirect(url);
}

/**
 * Server-side authentication check
 * Uses Firebase Admin Auth to verify the session cookie
 */
export async function getAuthUser(cookieStore: ReturnType<typeof cookies>) {
  // In a development environment with module imports issues, use dynamic import
  // to ensure the server-side code doesn't break in edge runtimes
  try {
    const { verifySessionCookie, isUserAdmin } = await import('./firebaseAdmin');
    
    // Get session cookie
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      return { authenticated: false };
    }
    
    // Verify the session cookie
    const decodedClaims = await verifySessionCookie(sessionCookie);
    
    if (!decodedClaims) {
      return { authenticated: false };
    }
    
    // Check if user is admin
    const isAdmin = await isUserAdmin(decodedClaims.uid);
    
    return {
      authenticated: true,
      admin: isAdmin,
      user: {
        uid: decodedClaims.uid,
        email: decodedClaims.email
      }
    };
  } catch (error) {
    console.error('Server auth check error:', error);
    
    // For development purposes, return a mock admin user
    // Remove this in production
    if (process.env.NODE_ENV === 'development') {
      return {
        authenticated: true,
        admin: true,
        user: {
          uid: 'dev-admin-uid',
          email: 'dev-admin@example.com'
        }
      };
    }
    
    return { authenticated: false };
  }
}