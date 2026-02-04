/**
 * @fileoverview Simple session management API
 * @module api/auth/simple-session
 *
 * @description
 * Simple, reliable session management for admin authentication.
 * Works in both development and production environments.
 * Integrates with authorization service for auto-provisioning.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loggers } from '@/lib/logger';
import { isEnvSuperAdmin, updateLastLogin } from '@/lib/authorization';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const logger = loggers.auth;

// Force Node.js runtime for cookie handling
export const runtime = 'nodejs';

interface SessionData {
  uid: string;
  email: string;
  timestamp: number;
  environment: string;
}

/**
 * Auto-provision or update user on login
 * - If user exists: update lastLogin
 * - If user doesn't exist but is in SUPER_ADMIN_EMAILS: create as super_admin
 * - If user doesn't exist and not in SUPER_ADMIN_EMAILS: do nothing (no admin access)
 */
async function handleUserProvisioning(uid: string, email: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // User exists - just update lastLogin
      await updateLastLogin(uid);
      logger.debug('Updated lastLogin for existing user', { uid, email });
    } else if (isEnvSuperAdmin(email)) {
      // User doesn't exist but is in SUPER_ADMIN_EMAILS - auto-provision as super_admin
      await setDoc(userRef, {
        email,
        role: 'super_admin',
        managedProperties: [],
        autoProvisioned: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
      logger.info('Auto-provisioned super admin user', { uid, email });
    } else {
      // User doesn't exist and is not a super admin - they won't have admin access
      logger.debug('User not in SUPER_ADMIN_EMAILS, not auto-provisioning', { email });
    }
  } catch (error) {
    // Log but don't fail the login - provisioning is best-effort
    logger.error('Error in user provisioning', error as Error, { uid, email });
  }
}

/**
 * Create session cookie
 */
export async function POST(request: NextRequest) {
  logger.debug('Creating session');

  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token required' },
        { status: 400 }
      );
    }

    // In development, create simple session without Firebase Admin
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Development mode - creating simple session');

      // For development, extract basic info from token (unsafe but fine for dev)
      // In production, this would verify with Firebase Admin
      const sessionData: SessionData = {
        uid: 'dev-user-' + Date.now(),
        email: 'dev@example.com',
        timestamp: Date.now(),
        environment: 'development'
      };

      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set('auth-session', sessionToken, {
        httpOnly: true,
        secure: false, // Development only
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      });

      // Auto-provision user if needed
      await handleUserProvisioning(sessionData.uid, sessionData.email);

      return NextResponse.json({
        success: true,
        user: {
          uid: sessionData.uid,
          email: sessionData.email
        },
        environment: 'development'
      });
    }

    // Production: Use Firebase Admin to verify token
    try {
      // Import Firebase Admin only in production
      const { verifyIdToken, createSessionCookie } = await import('@/lib/firebaseAdminNode');

      logger.debug('Production mode - verifying with Firebase Admin');

      const decodedToken = await verifyIdToken(idToken);
      if (!decodedToken) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }

      // Auto-provision user if needed (do this early so user has access immediately)
      await handleUserProvisioning(decodedToken.uid, decodedToken.email || '');

      // Create Firebase session cookie
      const sessionCookie = await createSessionCookie(idToken, {
        expiresIn: 60 * 60 * 24 * 7 * 1000 // 7 days
      });

      if (!sessionCookie) {
        // Fallback to simple session in production if Firebase Admin fails
        logger.warn('Firebase Admin failed, using fallback session');

        const sessionData: SessionData = {
          uid: decodedToken.uid,
          email: decodedToken.email || 'unknown@example.com',
          timestamp: Date.now(),
          environment: 'production-fallback'
        };

        const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

        const cookieStore = await cookies();
        cookieStore.set('auth-session', sessionToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        });

        return NextResponse.json({
          success: true,
          user: {
            uid: sessionData.uid,
            email: sessionData.email
          },
          environment: 'production-fallback'
        });
      }

      // Set Firebase session cookie
      const cookieStore = await cookies();
      cookieStore.set('auth-session', sessionCookie, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      });

      return NextResponse.json({
        success: true,
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email
        },
        environment: 'production'
      });

    } catch (adminError) {
      logger.error('Firebase Admin error', adminError as Error);

      // Fallback to development-style session
      const sessionData: SessionData = {
        uid: 'fallback-user-' + Date.now(),
        email: 'fallback@example.com',
        timestamp: Date.now(),
        environment: 'production-fallback'
      };

      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

      const cookieStore = await cookies();
      cookieStore.set('auth-session', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      });

      return NextResponse.json({
        success: true,
        user: {
          uid: sessionData.uid,
          email: sessionData.email
        },
        environment: 'production-fallback',
        warning: 'Using fallback session due to Firebase Admin issues'
      });
    }

  } catch (error) {
    logger.error('Session creation error', error as Error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

/**
 * Check session status
 */
export async function GET() {
  logger.debug('Checking session');

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth-session');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        authenticated: false,
        error: 'No session found'
      });
    }

    // Try to parse as simple session first
    try {
      const sessionData: SessionData = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString()
      );

      // Check if session is expired (7 days)
      const isExpired = Date.now() - sessionData.timestamp > (60 * 60 * 24 * 7 * 1000);

      if (isExpired) {
        return NextResponse.json({
          authenticated: false,
          error: 'Session expired'
        });
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          uid: sessionData.uid,
          email: sessionData.email
        },
        environment: sessionData.environment
      });

    } catch (parseError) {
      // If parsing fails, it might be a Firebase session cookie
      if (process.env.NODE_ENV === 'production') {
        try {
          const { verifySessionCookie } = await import('@/lib/firebaseAdminNode');
          const decodedClaims = await verifySessionCookie(sessionCookie.value);

          if (decodedClaims) {
            return NextResponse.json({
              authenticated: true,
              user: {
                uid: decodedClaims.uid,
                email: decodedClaims.email
              },
              environment: 'production'
            });
          }
        } catch (verifyError) {
          logger.error('Session verification error', verifyError as Error);
        }
      }

      return NextResponse.json({
        authenticated: false,
        error: 'Invalid session'
      });
    }

  } catch (error) {
    logger.error('Session check error', error as Error);
    return NextResponse.json(
      { error: 'Session check failed' },
      { status: 500 }
    );
  }
}

/**
 * Clear session
 */
export async function DELETE() {
  logger.debug('Clearing session');

  try {
    const cookieStore = await cookies();
    cookieStore.delete('auth-session');

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Session deletion error', error as Error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
