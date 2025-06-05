import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
  // In development, check for dev session first
  if (process.env.NODE_ENV === 'development') {
    const devSession = cookieStore.get('dev-session')?.value;
    
    if (devSession) {
      try {
        // Handle potential URL encoding of cookie value
        const cookieValue = decodeURIComponent(devSession);
        const devSessionData = JSON.parse(Buffer.from(cookieValue, 'base64').toString());
        console.log('[Auth Helpers] Development session found:', devSessionData.uid);
        
        return {
          authenticated: true,
          admin: true, // In development, treat all authenticated users as admin
          user: {
            uid: devSessionData.uid,
            email: devSessionData.email
          }
        };
      } catch (error) {
        console.error('[Auth Helpers] Error parsing dev session:', error);
      }
    }
    
    // No dev session, fall back to default dev behavior
    console.log('[Auth Helpers] No dev session found, returning unauthenticated');
    return { authenticated: false };
  }
  
  // Production: use Firebase Admin session verification
  try {
    const { verifySessionCookie, isUserAdmin } = await import('./firebaseAdminNode');
    
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
    return { authenticated: false };
  }
}