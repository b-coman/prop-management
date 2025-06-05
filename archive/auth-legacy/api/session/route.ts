/**
 * @fileoverview Session management API endpoint for admin authentication
 * @module api/auth/session
 * 
 * @description
 * Handles session cookie creation after successful Firebase authentication.
 * Receives Firebase ID token, verifies it, and creates HTTP-only session cookie
 * for server-side authentication.
 * 
 * @architecture
 * Part of: Admin authentication system
 * Layer: API/Infrastructure
 * Pattern: REST API endpoint
 * 
 * @dependencies
 * - Internal: firebaseAdminNode (session management)
 * - External: Firebase Admin SDK
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force Node.js runtime for Firebase Admin SDK
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('[Session API] POST request received');
  
  try {
    // Parse request body
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      console.error('[Session API] No ID token provided');
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    console.log('[Session API] ID token received, importing Firebase Admin functions...');
    
    // Import Firebase Admin functions
    const { verifyIdToken, createSessionCookie } = await import('@/lib/firebaseAdminNode');

    console.log('[Session API] Verifying ID token...');
    
    // Verify the ID token
    const decodedToken = await verifyIdToken(idToken);
    
    if (!decodedToken) {
      console.error('[Session API] ID token verification failed');
      return NextResponse.json(
        { error: 'Invalid ID token' },
        { status: 401 }
      );
    }

    console.log('[Session API] ID token verified for user:', decodedToken.uid);

    // Create session cookie (expires in 5 days)
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    
    console.log('[Session API] Creating session cookie...');
    const sessionCookie = await createSessionCookie(idToken, { expiresIn });

    if (!sessionCookie) {
      console.error('[Session API] Session cookie creation returned null');
      
      // In development, allow authentication without session cookies
      if (process.env.NODE_ENV === 'development') {
        console.log('[Session API] Development mode - proceeding without session cookie');
        return NextResponse.json({
          success: true,
          user: {
            uid: decodedToken.uid,
            email: decodedToken.email
          },
          warning: 'Session cookie not created - development mode'
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to create session cookie' },
        { status: 500 }
      );
    }

    // Set the session cookie (only if creation was successful)
    console.log('[Session API] Setting session cookie...');
    const cookieStore = cookies();
    cookieStore.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000, // Convert to seconds
      path: '/'
    });

    console.log('[Session API] Session cookie set successfully');
    return NextResponse.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email
      }
    });

  } catch (error) {
    console.error('[Session API] Error creating session:', error);
    console.error('[Session API] Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[Session API] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('[Session API] GET request - checking current session');
  
  try {
    const cookieStore = cookies();
    
    // In development, check dev-session cookie
    if (process.env.NODE_ENV === 'development') {
      const devSessionCookie = cookieStore.get('dev-session');
      
      if (devSessionCookie?.value) {
        try {
          // Handle potential URL encoding of cookie value
          const cookieValue = decodeURIComponent(devSessionCookie.value);
          const devSessionData = JSON.parse(Buffer.from(cookieValue, 'base64').toString());
          console.log('[Session API] Valid dev session found:', devSessionData.uid);
          
          return NextResponse.json({
            authenticated: true,
            user: {
              uid: devSessionData.uid,
              email: devSessionData.email
            },
            mode: 'development'
          });
        } catch (error) {
          console.error('[Session API] Error parsing dev session:', error);
        }
      }
    }
    
    // Production: check regular session cookie
    const sessionCookie = cookieStore.get('session');
    if (!sessionCookie?.value) {
      return NextResponse.json({
        authenticated: false,
        error: 'No session cookie found'
      });
    }
    
    // Verify session cookie (would need Firebase Admin in production)
    return NextResponse.json({
      authenticated: true,
      user: { uid: 'unknown', email: 'unknown' }
    });
    
  } catch (error) {
    console.error('[Session API] Error checking session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Clear the session cookie
    const cookieStore = cookies();
    cookieStore.delete('session');
    
    // In development, also clear dev session
    if (process.env.NODE_ENV === 'development') {
      cookieStore.delete('dev-session');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Session API] Error deleting session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}