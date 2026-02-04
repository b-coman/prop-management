/**
 * @fileoverview Admin check API for middleware
 * @module api/auth/check-admin
 *
 * @description
 * API endpoint for edge middleware to verify admin status.
 * Returns authorization result with role information.
 * This runs in Node.js runtime to access Firestore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/authorization';
import { loggers } from '@/lib/logger';

const logger = loggers.authorization;

// Force Node.js runtime for Firestore access
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const result = await checkAdminAccess();

    if (!result.authorized || !result.user) {
      return NextResponse.json({
        authorized: false,
        error: result.error || 'Not authorized'
      });
    }

    return NextResponse.json({
      authorized: true,
      role: result.user.role,
      email: result.user.email,
      managedProperties: result.user.managedProperties
    });

  } catch (error) {
    logger.error('Error in check-admin API', error as Error);
    return NextResponse.json(
      { authorized: false, error: 'Authorization check failed' },
      { status: 500 }
    );
  }
}
