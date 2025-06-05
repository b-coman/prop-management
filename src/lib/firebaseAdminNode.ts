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

/**
 * Verify a Firebase ID token
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken | null> {
  try {
    await initializeFirebaseAdminSafe();
    const auth = getAuthSafe();
    
    if (!auth) {
      console.error('[FirebaseAdminNode] Auth not initialized');
      return null;
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('[FirebaseAdminNode] Error verifying ID token:', error);
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
      console.error('[FirebaseAdminNode] Auth not initialized');
      return null;
    }

    const sessionCookie = await auth.createSessionCookie(idToken, options);
    return sessionCookie;
  } catch (error) {
    console.error('[FirebaseAdminNode] Error creating session cookie:', error);
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
      console.error('[FirebaseAdminNode] Auth not initialized');
      return null;
    }

    // Verify the session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    return decodedClaims;
  } catch (error) {
    console.error('[FirebaseAdminNode] Error verifying session cookie:', error);
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
      console.error('[FirebaseAdminNode] Auth not initialized');
      return false;
    }

    // Get user details
    const user = await auth.getUser(uid);
    
    // For now, use email whitelist
    // TODO: Replace with proper admin management system
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    
    // In development, allow any authenticated user
    if (process.env.NODE_ENV === 'development' && !adminEmails.length) {
      console.log('[FirebaseAdminNode] Development mode - allowing any authenticated user as admin');
      return true;
    }
    
    return user.email ? adminEmails.includes(user.email) : false;
  } catch (error) {
    console.error('[FirebaseAdminNode] Error checking admin status:', error);
    return false;
  }
}