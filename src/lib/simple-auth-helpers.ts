/**
 * @fileoverview Simple authentication helpers
 * @module lib/simple-auth-helpers
 * 
 * @description
 * Simple, reliable authentication helpers for server-side auth checks.
 * Works universally across all environments.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface AuthUser {
  uid: string;
  email: string;
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthUser;
  environment?: string;
}

/**
 * Check if user is authenticated (server-side)
 */
export async function checkAuthentication(): Promise<AuthResult> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('auth-session');

    if (!sessionCookie?.value) {
      return { authenticated: false };
    }

    // Try to parse as simple session
    try {
      const sessionData = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString()
      );

      // Check if session is expired (7 days)
      const isExpired = Date.now() - sessionData.timestamp > (60 * 60 * 24 * 7 * 1000);
      
      if (isExpired) {
        return { authenticated: false };
      }

      return {
        authenticated: true,
        user: {
          uid: sessionData.uid,
          email: sessionData.email
        },
        environment: sessionData.environment
      };

    } catch (parseError) {
      // If parsing fails, it might be a Firebase session cookie
      if (process.env.NODE_ENV === 'production') {
        try {
          const { verifySessionCookie } = await import('@/lib/firebaseAdminNode');
          const decodedClaims = await verifySessionCookie(sessionCookie.value);
          
          if (decodedClaims) {
            return {
              authenticated: true,
              user: {
                uid: decodedClaims.uid,
                email: decodedClaims.email || 'unknown@example.com'
              },
              environment: 'production'
            };
          }
        } catch (verifyError) {
          console.error('[SimpleAuthHelpers] Session verification error:', verifyError);
        }
      }

      return { authenticated: false };
    }

  } catch (error) {
    console.error('[SimpleAuthHelpers] Authentication check error:', error);
    return { authenticated: false };
  }
}

/**
 * Require authentication (redirect to login if not authenticated)
 */
export async function requireAuthentication(): Promise<AuthUser> {
  const authResult = await checkAuthentication();
  
  if (!authResult.authenticated || !authResult.user) {
    redirect('/login');
  }
  
  return authResult.user;
}

/**
 * Check if user is admin (for now, all authenticated users are admin)
 */
export async function checkAdminAccess(): Promise<AuthUser> {
  const user = await requireAuthentication();
  
  // For now, all authenticated users have admin access
  // In the future, this could check against a list of admin emails
  console.log('[SimpleAuthHelpers] Admin access granted to:', user.email);
  
  return user;
}