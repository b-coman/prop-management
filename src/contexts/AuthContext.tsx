// src/contexts/AuthContext.tsx
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
  AuthErrorCodes,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true); // Tracks initial onAuthStateChanged
  const [redirectResultProcessing, setRedirectResultProcessing] = useState(true); // Tracks getRedirectResult
  const router = useRouter();

  // Effect for onAuthStateChanged
  useEffect(() => {
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized for onAuthStateChanged.");
      setAuthInitializing(false);
      setRedirectResultProcessing(false); // If auth fails, no redirect to process
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("[AuthProvider] onAuthStateChanged. User:", currentUser ? currentUser.uid : null);
      setUser(currentUser);
      setAuthInitializing(false); // Initial auth state determined
    });

    return () => unsubscribe();
  }, []); // Runs once on mount

  // Effect for getRedirectResult
  useEffect(() => {
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized for getRedirectResult.");
      setRedirectResultProcessing(false);
      return;
    }
    
    // Only process redirect if auth has initialized (to avoid race conditions)
    // and redirect processing hasn't been marked as complete yet.
    if (!authInitializing) {
        getRedirectResult(auth)
        .then((result) => {
            if (result) {
            console.log("[AuthProvider] Google sign-in via redirect processed. User (from result):", result.user.uid);
            // setUser(result.user); // Not strictly necessary, onAuthStateChanged will update.
            } else {
            console.log("[AuthProvider] No pending redirect result.");
            }
        })
        .catch((error: any) => {
            if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
            console.error(
                '❌ Error processing Google Sign-In redirect: Unauthorized domain. ' +
                'Ensure your current domain is added to the list of authorized domains ' +
                'in your Firebase project settings (Authentication -> Sign-in method -> Google -> Authorized domains). ' +
                `Current domain is likely: ${typeof window !== 'undefined' ? window.location.hostname : 'unknown'}`
            );
            } else if (error.code === 'auth/no-auth-event' || error.code === 'auth/redirect-cancelled' || error.code === 'auth/redirect-error') {
            console.log(`[AuthProvider] Redirect status/error: ${error.code} - ${error.message}`);
            } else {
            console.error('❌ Error processing Google Sign-In redirect result:', error);
            }
        })
        .finally(() => {
            console.log("[AuthProvider] Finished processing redirect result.");
            setRedirectResultProcessing(false); // Redirect processing is complete
        });
    }
  }, [auth, authInitializing]); // Rerun if auth or authInitializing changes

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized for signInWithGoogle.");
      return;
    }
    setAuthInitializing(true); // Reset flags when initiating a new sign-in
    setRedirectResultProcessing(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // Page will redirect.
    } catch (error: any) {
      if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
         console.error(/* ... existing error message ... */);
      } else {
        console.error('❌ Error initiating Google sign-in with redirect:', error);
      }
      setAuthInitializing(false); // If initiation fails, stop loading states
      setRedirectResultProcessing(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized for logout.");
      return;
    }
    setAuthInitializing(true); // Indicate an auth state change is about to happen
    setRedirectResultProcessing(true); // Not a redirect, but reset to ensure loading state is correct
    try {
      await firebaseSignOut(auth);
      // setUser(null) and loading states will be handled by onAuthStateChanged and subsequent effects
      router.push('/login');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      setAuthInitializing(false); // Reset if logout fails
      setRedirectResultProcessing(false);
    }
  };

  const overallLoading = authInitializing || redirectResultProcessing;

  if (overallLoading && !auth) { // If still "loading" but auth object itself failed
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">Error: Firebase Authentication failed to initialize properly.</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading: overallLoading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
