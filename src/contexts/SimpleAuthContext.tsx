/**
 * @fileoverview Simple, universal authentication context
 * @module contexts/SimpleAuthContext
 * 
 * @description
 * Universal authentication system that works across all browsers and environments.
 * Uses redirect-only flow to avoid popup blocking issues.
 * Simple, reliable, and maintainable.
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      console.error('[SimpleAuth] Firebase auth not initialized');
      setLoading(false);
      return;
    }

    console.log('[SimpleAuth] Setting up auth state listener');

    // Check for redirect result first (user returning from Google OAuth)
    getRedirectResult(auth)
      .then(async (result) => {
        console.log('[SimpleAuth] getRedirectResult completed, result:', result ? 'found' : 'null');
        if (result) {
          console.log('[SimpleAuth] Redirect result found:', result.user.email);
          // Create session on server
          const sessionOk = await createServerSession(result.user);
          setSessionCreated(sessionOk);
          if (sessionOk) {
            // Redirect to admin using full page navigation
            window.location.href = '/admin';
          }
        }
      })
      .catch((error) => {
        console.error('[SimpleAuth] Redirect result error:', error.code, error.message);
      });

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[SimpleAuth] Auth state changed:', user?.email || 'null');
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [router]);

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error('[SimpleAuth] Firebase auth not initialized');
      return;
    }

    try {
      setLoading(true);
      setSigningIn(true);

      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');

      // Try popup first (more reliable), fall back to redirect if blocked
      try {
        console.log('[SimpleAuth] Starting Google sign-in (popup)');
        const result = await signInWithPopup(auth, provider);
        console.log('[SimpleAuth] Popup sign-in successful:', result.user.email);

        // Create session on server and wait for it
        const sessionOk = await createServerSession(result.user);
        setSessionCreated(sessionOk);

        if (sessionOk) {
          console.log('[SimpleAuth] Session created, redirecting to admin');
          // Use replace to avoid back button issues
          window.location.href = '/admin';
        } else {
          console.error('[SimpleAuth] Session creation failed, not redirecting');
          setLoading(false);
        }
      } catch (popupError: unknown) {
        const error = popupError as { code?: string };
        // If popup is blocked or fails, try redirect
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
          console.log('[SimpleAuth] Popup blocked/closed, falling back to redirect');
          await signInWithRedirect(auth, provider);
        } else {
          throw popupError;
        }
      }

    } catch (error) {
      console.error('[SimpleAuth] Sign-in error:', error);
      setLoading(false);
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    if (!auth) {
      console.error('[SimpleAuth] Firebase auth not initialized');
      return;
    }

    try {
      console.log('[SimpleAuth] Signing out user');
      setLoading(true);
      
      // Clear server session
      await clearServerSession();
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Redirect to login
      router.push('/login');
      
    } catch (error) {
      console.error('[SimpleAuth] Sign-out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    signingIn,
    signInWithGoogle,
    signOut: signOutUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Create session on server
 * Returns true if session was created successfully
 */
async function createServerSession(user: User): Promise<boolean> {
  try {
    const idToken = await user.getIdToken();

    const response = await fetch('/api/auth/simple-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      console.error('[SimpleAuth] Session creation failed:', response.statusText);
      return false;
    }

    const result = await response.json();
    console.log('[SimpleAuth] Server session created:', result.environment);
    return true;
  } catch (error) {
    console.error('[SimpleAuth] Session creation error:', error);
    return false;
  }
}

/**
 * Clear session on server
 */
async function clearServerSession() {
  try {
    const response = await fetch('/api/auth/simple-session', {
      method: 'DELETE',
    });

    if (response.ok) {
      console.log('[SimpleAuth] Server session cleared successfully');
    }
  } catch (error) {
    console.error('[SimpleAuth] Session clearing error:', error);
  }
}