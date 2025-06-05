/**
 * @fileoverview Safari-specific authentication fixes
 * @module lib/safari-auth-fix
 * 
 * @description
 * Handles Safari-specific authentication issues:
 * - Popup blocking detection
 * - Fallback to redirect flow
 * - Cross-origin policy handling
 */

import { Auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

/**
 * Detect if we're running in Safari
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  return /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Chromium/.test(userAgent);
}

/**
 * Detect if popups are likely blocked
 */
export function isPopupBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const popup = window.open('', '_blank', 'width=1,height=1');
    if (popup) {
      popup.close();
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

/**
 * Safari-aware Google sign-in with automatic fallback
 */
export async function safariAwareGoogleSignIn(auth: Auth) {
  console.log('[Safari Auth] Starting Safari-aware authentication...');
  
  const provider = new GoogleAuthProvider();
  
  // Add required scopes
  provider.addScope('email');
  provider.addScope('profile');
  
  // For Safari, prefer redirect flow due to reliability issues with popups
  if (isSafari()) {
    console.log('[Safari Auth] Safari detected, using redirect flow for reliability...');
    return await signInWithRedirect(auth, provider);
  } else {
    // Non-Safari browsers: use popup
    console.log('[Safari Auth] Non-Safari browser, using popup...');
    return await signInWithPopup(auth, provider);
  }
}

/**
 * Check for redirect result on page load (for Safari redirect flow)
 */
export async function checkRedirectResult(auth: Auth) {
  console.log('[Safari Auth] Checking for redirect result...');
  
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('[Safari Auth] Redirect result found:', result.user.uid);
      return result;
    }
    console.log('[Safari Auth] No redirect result found');
    return null;
  } catch (error) {
    console.error('[Safari Auth] Error checking redirect result:', error);
    return null;
  }
}

/**
 * Safari-specific cookie settings
 */
export const safariCookieOptions = {
  sameSite: 'None' as const,
  secure: true, // Required for SameSite=None
  httpOnly: true,
  path: '/',
  maxAge: 60 * 60 * 24 // 24 hours
};

/**
 * Check if current request is from Safari
 */
export function isSafariRequest(userAgent: string): boolean {
  return /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Chromium/.test(userAgent);
}