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
import { useRouter } from 'next/navigation'; // Keep for potential future use, but not in logout

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
  const router = useRouter(); // Keep for potential future use

  useEffect(() => {
    console.log("[AuthProvider] useEffect: Setting up auth state listener and redirect processor.");
    // Initialize flags at the start of the effect if they aren't already true
    // This ensures that on re-evaluation (if deps change), loading state is reset.
    setAuthInitializing(true);
    setRedirectResultProcessing(true);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log(`[AuthProvider] onAuthStateChanged fired. New User: ${currentUser ? currentUser.uid : null}. Current local user state: ${user ? user.uid : null}`);
      setUser(currentUser);
      // Only set authInitializing to false after the first onAuthStateChanged event
      // This indicates that Firebase has checked the initial auth state.
      if (authInitializing) {
        setAuthInitializing(false);
        console.log("[AuthProvider] onAuthStateChanged: authInitializing set to false (initial auth state checked).");
      }
    });

    // Process redirect result
    console.log("[AuthProvider] Attempting to get redirect result...");
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          console.log("[AuthProvider] getRedirectResult SUCCESS. User from redirect:", result.user.uid);
          // Firebase best practice: onAuthStateChanged is the single source of truth for user state.
          // getRedirectResult processes the credential, and onAuthStateChanged will subsequently fire with the new user.
          // Explicitly setting user here (setUser(result.user)) can sometimes lead to race conditions or double updates.
        } else {
          console.log("[AuthProvider] getRedirectResult: No user from redirect or no redirect was pending.");
        }
      })
      .catch((error: any) => {
        if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
          console.error(
            '❌ [AuthProvider] getRedirectResult Error: Unauthorized domain. Domain:',
            typeof window !== 'undefined' ? window.location.hostname : 'unknown',
            'Ensure this is in Firebase Console -> Authentication -> Settings -> Authorized domains.'
          );
        } else if (['auth/no-auth-event', 'auth/redirect-cancelled', 'auth/redirect-error', 'auth/popup-closed-by-user'].includes(error.code)) {
          console.log(`[AuthProvider] getRedirectResult: Common redirect status/error: ${error.code} - ${error.message}`);
        }
        else {
          console.error("[AuthProvider] getRedirectResult ERROR (unhandled):", error.code, error.message);
        }
      })
      .finally(() => {
        console.log("[AuthProvider] getRedirectResult processing FINISHED.");
        setRedirectResultProcessing(false); // Redirect processing is done
      });

    return () => {
      console.log("[AuthProvider] useEffect cleanup: Unsubscribing onAuthStateChanged.");
      unsubscribe();
    };
  // Dependency array:
  // - `auth`: If `auth` itself could be null/undefined initially and then re-initialize (e.g. if firebase.ts is async),
  //   then including `auth` would be crucial. Assuming `auth` is stable once firebase app is initialized.
  // - Empty array `[]`: Ensures this runs once on mount and cleans up on unmount. This is typical for auth listeners.
  }, []); // Runs once on mount

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("[AuthProvider] signInWithGoogle: Firebase Auth is not initialized.");
      return;
    }
    console.log("[AuthProvider] signInWithGoogle called. Initiating redirect.");
    setAuthInitializing(true); // Reset loading states before auth operation
    setRedirectResultProcessing(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      console.log("[AuthProvider] signInWithRedirect initiated. Page will redirect.");
      // The rest is handled by onAuthStateChanged and getRedirectResult after redirect.
    } catch (error: any) {
      console.error('❌ [AuthProvider] Error initiating Google sign-in with redirect:', error.code, error.message);
      setAuthInitializing(false); // Reset loading state on error
      setRedirectResultProcessing(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      console.error("[AuthProvider] logout: Firebase Auth is not initialized.");
      return;
    }
    console.log("[AuthProvider] logout called.");
    try {
      await firebaseSignOut(auth);
      console.log("[AuthProvider] Firebase signOut successful. User state will be updated by onAuthStateChanged.");
      // Removed router.push('/login');
      // The ProtectedAdminLayout or LoginPage should react to the user becoming null.
    } catch (error) {
      console.error('❌ [AuthProvider] Error signing out:', error);
    }
  };

  const overallLoading = authInitializing || redirectResultProcessing;
  console.log(`[AuthProvider] Render. overallLoading: ${overallLoading} (authInitializing: ${authInitializing}, redirectResultProcessing: ${redirectResultProcessing}), User: ${user ? user.uid : 'null'}`);

  if (!auth && typeof window !== 'undefined' && (window as any).__NEXT_HYDRATED) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">Error: Firebase Authentication failed to initialize properly. Check console.</p>
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
