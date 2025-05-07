// src/contexts/AuthContext.tsx
'use client';

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect, // Changed from signInWithPopup
  getRedirectResult, // Added for signInWithRedirect
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
  AuthErrorCodes,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized.");
      setLoading(false);
      return;
    }
    // This handles initial auth state and subsequent changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      // console.log("[AuthProvider] onAuthStateChanged. User:", currentUser ? currentUser.uid : null, "Loading:", false);
    });
    return () => unsubscribe();
  }, []);


  // This effect handles the result of a redirect-based sign-in
  useEffect(() => {
    if (!auth) return; // Wait for auth to be initialized

    const processRedirectResult = async () => {
      // It's possible onAuthStateChanged already set loading to false.
      // If we are in a redirect flow, we might want to set loading to true again.
      // However, getRedirectResult itself doesn't always mean loading should be true,
      // as it also runs on normal page loads to check if there's a PENDING redirect.
      // Let's rely on the onAuthStateChanged to manage the primary loading state.
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User successfully signed in via redirect.
          // onAuthStateChanged will typically handle setting the user state.
          // This log confirms the redirect flow completed.
          console.log("[AuthProvider] Google sign-in via redirect successful. User:", result.user.uid);
          // setUser(result.user); // Usually redundant as onAuthStateChanged will fire
          // setLoading(false); // onAuthStateChanged handles this
        } else {
          // No redirect result pending. This is normal on initial page loads.
          // console.log("[AuthProvider] No pending redirect result.");
        }
      } catch (error: any) {
        if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
          console.error(
            '❌ Error processing Google Sign-In redirect: Unauthorized domain. ' +
            'Please ensure your current domain is added to the list of authorized domains ' +
            'in your Firebase project settings (Authentication -> Sign-in method -> Google -> Authorized redirect URIs). ' +
            `Current domain is likely: ${window.location.hostname}`
          );
        } else if (error.code === 'auth/no-auth-event' || error.code === 'auth/redirect-cancelled') {
          // These errors are expected if there's no pending redirect or user cancels.
          // console.log(`[AuthProvider] Redirect status: ${error.message}`);
        }
         else {
          console.error('❌ Error processing Google Sign-In redirect result:', error);
        }
        // setLoading(false); // onAuthStateChanged should handle this
      }
    };

    processRedirectResult();
  }, [auth]); // Dependency: run when auth object is available.

  const signInWithGoogle = async () => {
    if (!auth) {
        console.error("[AuthProvider] Firebase Auth is not initialized for signInWithGoogle.");
        return;
    }
    setLoading(true); // Indicate that an auth process is starting
    try {
      const provider = new GoogleAuthProvider();
      // signInWithRedirect doesn't return a promise that resolves with user credentials here.
      // It navigates the user. The result is handled by getRedirectResult on page load.
      await signInWithRedirect(auth, provider);
      // Page will redirect, so code after this might not execute immediately.
    } catch (error: any) {
      // This catch block might not be hit for typical redirect errors,
      // as the page navigates away. Errors are more likely caught by getRedirectResult.
      if (error.code === AuthErrorCodes.UNAUTHORIZED_DOMAIN) {
        console.error( /* ... existing error message ... */ );
      } else {
        console.error('❌ Error initiating Google sign-in with redirect:', error);
      }
      setLoading(false); // Ensure loading is reset if redirect initiation fails
    }
  };

  const logout = async () => {
    if (!auth) {
        console.error("[AuthProvider] Firebase Auth is not initialized for logout.");
        return;
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null); // Explicitly set user to null
      router.push('/login');
    } catch (error) {
      console.error('❌ Error signing out:', error);
    } finally {
        setLoading(false);
    }
  };
  
  if (loading && !auth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">Error: Firebase Authentication failed to initialize.</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
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
