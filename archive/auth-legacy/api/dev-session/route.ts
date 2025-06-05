/**
 * @fileoverview Development-only session management
 * @module api/auth/dev-session
 * 
 * @description
 * Simple session management for development that doesn't rely on Firebase Admin SDK
 * This bypasses network issues with Google OAuth in development environments
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force Node.js runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Dev session endpoint only available in development' },
      { status: 403 }
    );
  }

  console.log('[Dev Session] Creating development session...');
  
  try {
    const body = await request.json();
    const { user } = body;

    if (!user || !user.uid) {
      return NextResponse.json(
        { error: 'User data required' },
        { status: 400 }
      );
    }

    // Create a simple development session token
    const devSessionData = {
      uid: user.uid,
      email: user.email,
      timestamp: Date.now(),
      mode: 'development'
    };

    const devSession = Buffer.from(JSON.stringify(devSessionData)).toString('base64');

    // Set development session cookie
    const cookieStore = cookies();
    cookieStore.set('dev-session', devSession, {
      httpOnly: true,
      secure: false, // Development only
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    });

    console.log('[Dev Session] Development session created for user:', user.uid);

    return NextResponse.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email
      },
      mode: 'development'
    });

  } catch (error) {
    console.error('[Dev Session] Error creating development session:', error);
    return NextResponse.json(
      { error: 'Failed to create development session' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Dev session endpoint only available in development' },
      { status: 403 }
    );
  }

  const cookieStore = cookies();
  cookieStore.delete('dev-session');

  return NextResponse.json({ success: true });
}