/**
 * @fileoverview Firebase Admin SDK functions for Node.js runtime
 * @module lib/firebaseAdminNode
 *
 * @description
 * Provides Firebase Admin authentication functions that require Node.js runtime.
 * Includes session cookie management, token verification, and admin user checks.
 * This file should only be imported in server components with nodejs runtime.
 *
 * @architecture
 * Part of: Authentication system
 * Layer: Infrastructure/Security
 * Pattern: Service module
 *
 * @dependencies
 * - Internal: firebaseAdminSafe (safe initialization)
 * - External: firebase-admin
 */

import { initializeFirebaseAdminSafe, getAuthSafe } from './firebaseAdminSafe';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { loggers } from '@/lib/logger';

const logger = loggers.admin;

/**
 * Verify a Firebase ID token
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken | null> {
  try {
    await initializeFirebaseAdminSafe();
    const auth = getAuthSafe();

    if (!auth) {
      logger.error('Auth not initialized for token verification');
      return null;
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logger.error('Error verifying ID token', error as Error);
    return null;
  }
}

/**
 * Create a session cookie from an ID token
 */
export async function createSessionCookie(
  idToken: string,
  options: { expiresIn: number }
): Promise<string | null> {
  try {
    await initializeFirebaseAdminSafe();
    const auth = getAuthSafe();

    if (!auth) {
      logger.error('Auth not initialized for session cookie creation');
      return null;
    }

    const sessionCookie = await auth.createSessionCookie(idToken, options);
    return sessionCookie;
  } catch (error) {
    logger.error('Error creating session cookie', error as Error);
    return null;
  }
}

/**
 * Verify a session cookie and return the decoded token
 */
export async function verifySessionCookie(
  sessionCookie: string
): Promise<DecodedIdToken | null> {
  try {
    await initializeFirebaseAdminSafe();
    const auth = getAuthSafe();

    if (!auth) {
      logger.error('Auth not initialized for session verification');
      return null;
    }

    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    return decodedClaims;
  } catch (error) {
    logger.error('Error verifying session cookie', error as Error);
    return null;
  }
}

/**
 * Check if a user is an admin
 * For now, this checks if the user email is in an allowed list
 * TODO: Implement proper admin user management (Issue #16)
 */
export async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    await initializeFirebaseAdminSafe();
    const auth = getAuthSafe();

    if (!auth) {
      logger.error('Auth not initialized for admin check');
      return false;
    }

    const user = await auth.getUser(uid);
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];

    // In development, allow any authenticated user
    if (process.env.NODE_ENV === 'development' && !adminEmails.length) {
      logger.debug('Development mode - allowing any authenticated user as admin');
      return true;
    }

    return user.email ? adminEmails.includes(user.email) : false;
  } catch (error) {
    logger.error('Error checking admin status', error as Error, { uid });
    return false;
  }
}
