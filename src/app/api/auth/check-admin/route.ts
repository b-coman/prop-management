/**
 * @fileoverview Admin check API for middleware
 * @module api/auth/check-admin
 *
 * @description
 * API endpoint for edge middleware to verify admin status.
 * Returns authorization result with role information.
 * This runs in Node.js runtime to access Firestore via Admin SDK.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { initializeFirebaseAdminSafe } from '@/lib/firebaseAdminSafe';
import { getFirestore } from 'firebase-admin/firestore';
import { loggers } from '@/lib/logger';

const logger = loggers.authorization;

// Force Node.js runtime for Firestore access
export const runtime = 'nodejs';

interface SessionData {
  uid: string;
  email: string;
  timestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    // Get session from cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth-session');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        authorized: false,
        error: 'No session'
      });
    }

    // Parse session
    let sessionData: SessionData;
    try {
      sessionData = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString()
      );
    } catch {
      return NextResponse.json({
        authorized: false,
        error: 'Invalid session format'
      });
    }

    // Check session expiry (7 days)
    if (Date.now() - sessionData.timestamp > (60 * 60 * 24 * 7 * 1000)) {
      return NextResponse.json({
        authorized: false,
        error: 'Session expired'
      });
    }

    // Use Admin SDK to fetch user document (bypasses rules)
    const adminApp = await initializeFirebaseAdminSafe();
    if (!adminApp) {
      logger.error('Admin SDK not available');
      return NextResponse.json({
        authorized: false,
        error: 'Server configuration error'
      });
    }

    const db = getFirestore(adminApp);
    const userDoc = await db.collection('users').doc(sessionData.uid).get();

    if (!userDoc.exists) {
      logger.debug('User document not found', { uid: sessionData.uid });
      return NextResponse.json({
        authorized: false,
        error: 'User not found'
      });
    }

    const userData = userDoc.data()!;
    const role = userData.role;

    // Check if user has admin role
    if (role !== 'super_admin' && role !== 'property_owner') {
      logger.debug('User has no admin role', { uid: sessionData.uid, role });
      return NextResponse.json({
        authorized: false,
        error: 'Not an admin'
      });
    }

    logger.debug('Admin check passed', { uid: sessionData.uid, role });

    return NextResponse.json({
      authorized: true,
      role: role,
      email: userData.email || sessionData.email,
      managedProperties: userData.managedProperties || []
    });

  } catch (error) {
    logger.error('Error in check-admin API', error as Error);
    return NextResponse.json(
      { authorized: false, error: 'Authorization check failed' },
      { status: 500 }
    );
  }
}
