/**
 * @fileoverview Simple authentication helpers
 * @module lib/simple-auth-helpers
 *
 * @description
 * Simple, reliable authentication helpers for server-side auth checks.
 * Integrates with the authorization service for admin access control.
 * Works universally across all environments.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  checkAdminAccess as checkAuthorizationAccess,
  type AdminUser,
  type AuthorizationResult
} from '@/lib/authorization';
import { loggers } from '@/lib/logger';

const logger = loggers.auth;

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
 * This is a basic authentication check - it only verifies the session is valid
 */
export async function checkAuthentication(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
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
          logger.error('Session verification error', verifyError as Error);
        }
      }

      return { authenticated: false };
    }

  } catch (error) {
    logger.error('Authentication check error', error as Error);
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
 * Check if user has admin access
 * Returns the full authorization result with AdminUser if authorized
 */
export async function checkAdminAccess(): Promise<AuthorizationResult> {
  return checkAuthorizationAccess();
}

/**
 * Require admin access - redirects to login with error if not authorized
 * Returns the full AdminUser object with role and permissions
 */
export async function requireAdminAccess(): Promise<AdminUser> {
  const result = await checkAuthorizationAccess();

  if (!result.authorized || !result.user) {
    logger.warn('Admin access denied', { error: result.error });
    redirect('/login?error=unauthorized');
  }

  return result.user;
}

// Re-export types from authorization for convenience
export type { AdminUser, AuthorizationResult } from '@/lib/authorization';
