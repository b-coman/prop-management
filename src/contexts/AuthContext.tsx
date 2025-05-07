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
  const [authInitializing, setAuthInitializing] = useState(true);
  const [redirectResultProcessing, setRedirectResultProcessing] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log("[AuthProvider] Mounting. Initializing auth listener.");
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized for onAuthStateChanged.");
      setAuthInitializing(false);
      setRedirectResultProcessing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("[AuthProvider] onAuthStateChanged event. User:", currentUser ? currentUser.uid : null, "Current local user state:", user ? user.uid : null);
      setUser(currentUser);
      if (authInitializing) {
        console.log("[AuthProvider] onAuthStateChanged: Auth initializing finished.");
        setAuthInitializing(false);
      }
    });

    // Initial check for redirect result
    console.log("[AuthProvider] Attempting to get redirect result on mount/auth change.");
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("[AuthProvider] Google sign-in via redirect processed on mount. User (from result):", result.user.uid);
          // setUser(result.user); // onAuthStateChanged should handle this
        } else {
          console.log("[AuthProvider] No pending redirect result on mount.");
        }
      })
      .catch((error: any) => {
        if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
          console.error(
            '❌ Error processing Google Sign-In redirect: Unauthorized domain. Ensure your current domain is added to the list of authorized domains in your Firebase project settings (Authentication -> Sign-in method -> Google -> Authorized domains). Current domain is likely:',
            typeof window !== 'undefined' ? window.location.hostname : 'unknown'
          );
        } else if (['auth/no-auth-event', 'auth/redirect-cancelled', 'auth/redirect-error'].includes(error.code)) {
          console.log(`[AuthProvider] Redirect status/error on mount: ${error.code} - ${error.message}`);
        } else {
          console.error('❌ Error processing Google Sign-In redirect result on mount:', error);
        }
      })
      .finally(() => {
        console.log("[AuthProvider] Finished processing redirect result on mount.");
        setRedirectResultProcessing(false);
      });

    return () => {
      console.log("[AuthProvider] Unmounting. Unsubscribing from auth listener.");
      unsubscribe();
    };
  }, []); // Effect for onAuthStateChanged and initial getRedirectResult

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized for signInWithGoogle.");
      return;
    }
    console.log("[AuthProvider] signInWithGoogle called. Setting loading states.");
    setAuthInitializing(true); 
    setRedirectResultProcessing(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      console.log("[AuthProvider] signInWithRedirect initiated.");
      // Page will redirect.
    } catch (error: any) {
      if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
        console.error(
          '❌ Error initiating Google sign-in: Unauthorized domain. Current domain:',
          typeof window !== 'undefined' ? window.location.hostname : 'unknown'
        );
      } else {
        console.error('❌ Error initiating Google sign-in with redirect:', error);
      }
      setAuthInitializing(false); 
      setRedirectResultProcessing(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized for logout.");
      return;
    }
    console.log("[AuthProvider] logout called.");
    setAuthInitializing(true); 
    setRedirectResultProcessing(true); // Reset to ensure loading state is correct
    try {
      await firebaseSignOut(auth);
      console.log("[AuthProvider] Firebase signOut successful. User should be null via onAuthStateChanged. Redirecting to /login.");
      // setUser(null) and loading states will be handled by onAuthStateChanged.
      router.push('/login'); // Explicitly redirect to login page.
    } catch (error) {
      console.error('❌ Error signing out:', error);
      setAuthInitializing(false); 
      setRedirectResultProcessing(false);
    }
  };

  const overallLoading = authInitializing || redirectResultProcessing;
  console.log(`[AuthProvider] Render. overallLoading: ${overallLoading} (authInitializing: ${authInitializing}, redirectResultProcessing: ${redirectResultProcessing}), User: ${user ? user.uid : null}`);


  if (overallLoading && !auth && typeof window !== 'undefined' && (window as any).__NEXT_HYDRATED) { 
    // Check if client-side and hydration has occurred
    // This condition is tricky because `auth` might be null legitimately during SSR if firebase.ts hasn't run.
    // Only show hard error on client if auth is still null after hydration and we are "loading".
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
