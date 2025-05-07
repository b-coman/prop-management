// src/contexts/AuthContext.tsx
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup, // Changed from signInWithRedirect
  // getRedirectResult, // No longer needed for popup
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
  // const [redirectResultProcessing, setRedirectResultProcessing] = useState(true); // No longer needed for popup
  const router = useRouter();

  useEffect(() => {
    console.log("[AuthProvider] useEffect: Setting up auth state listener.");
    setAuthInitializing(true); // Reset loading state

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log(`[AuthProvider] onAuthStateChanged fired. New User: ${currentUser ? currentUser.uid : 'null'}. Current local user state: ${user ? user.uid : 'null'}`);
      setUser(currentUser);
      if (authInitializing) {
        setAuthInitializing(false);
        console.log("[AuthProvider] onAuthStateChanged: authInitializing set to false.");
      }
    });

    // getRedirectResult logic removed as it's for signInWithRedirect
    // setRedirectResultProcessing(false); // No longer processing redirect result

    return () => {
      console.log("[AuthProvider] useEffect cleanup: Unsubscribing onAuthStateChanged.");
      unsubscribe();
    };
  }, []); // Keep empty dependency array

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("[AuthProvider] signInWithGoogle (popup): Firebase Auth is not initialized.");
      return;
    }
    console.log("[AuthProvider] signInWithGoogle (popup) called. Initiating popup.");
    setAuthInitializing(true); // Set loading state
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle setting the user
      console.log("[AuthProvider] signInWithPopup successful. User:", result.user.uid);
    } catch (error: any) {
      if (error.code === AuthErrorCodes.POPUP_CLOSED_BY_USER) {
        console.warn('[AuthProvider] signInWithPopup: Popup closed by user.');
      } else if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
        console.error(
          '❌ [AuthProvider] signInWithPopup Error: Unauthorized domain. Domain:',
          typeof window !== 'undefined' ? window.location.hostname : 'unknown',
          'Ensure this is in Firebase Console -> Authentication -> Settings -> Authorized domains.'
        );
      } else {
        console.error('❌ [AuthProvider] Error signing in with Google (popup):', error.code, error.message);
      }
      // setUser(null); // Ensure user is null on error
    } finally {
      setAuthInitializing(false); // Reset loading state
    }
  };

  const logout = async () => {
    if (!auth) {
      console.error("[AuthProvider] logout: Firebase Auth is not initialized.");
      return;
    }
    console.log("[AuthProvider] logout called.");
    setAuthInitializing(true);
    try {
      await firebaseSignOut(auth);
      console.log("[AuthProvider] Firebase signOut successful. User state will be updated by onAuthStateChanged.");
      // No need to manually setUser(null) here, onAuthStateChanged handles it
      router.push('/login'); // Redirect to login page after logout
    } catch (error) {
      console.error('❌ [AuthProvider] Error signing out:', error);
    } finally {
      setAuthInitializing(false);
    }
  };

  // Simplified loading state for popup flow
  const overallLoading = authInitializing;
  console.log(`[AuthProvider] Render. overallLoading: ${overallLoading} (authInitializing: ${authInitializing}), User: ${user ? user.uid : 'null'}`);

  if (!auth && typeof window !== 'undefined' && (window as any).__NEXT_HYDRATED) {
    console.error("❌ [AuthProvider] Firebase Auth object is not available during render. Firebase likely failed to initialize.");
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
