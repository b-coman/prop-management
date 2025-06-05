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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
        if (result) {
          console.log('[SimpleAuth] Redirect result found:', result.user.email);
          // Create session on server
          await createServerSession(result.user);
          // Redirect to admin
          router.push('/admin');
        }
      })
      .catch((error) => {
        console.error('[SimpleAuth] Redirect result error:', error);
      });

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[SimpleAuth] Auth state changed:', user?.email || 'null');
      setUser(user);
      
      // If user is authenticated, ensure server session exists
      if (user) {
        await createServerSession(user);
      }
      
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
      console.log('[SimpleAuth] Starting Google sign-in (redirect)');
      setLoading(true);
      
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      // Always use redirect - works universally across all browsers
      await signInWithRedirect(auth, provider);
      
    } catch (error) {
      console.error('[SimpleAuth] Sign-in error:', error);
      setLoading(false);
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
 */
async function createServerSession(user: User) {
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
    } else {
      const result = await response.json();
      console.log('[SimpleAuth] Server session created:', result.environment);
    }
  } catch (error) {
    console.error('[SimpleAuth] Session creation error:', error);
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