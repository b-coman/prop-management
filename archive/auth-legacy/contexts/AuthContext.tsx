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
import { safariAwareGoogleSignIn, checkRedirectResult, isSafari } from '@/lib/safari-auth-fix';
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
    console.log("[AuthProvider] Auth object status:", auth ? "Available" : "NOT AVAILABLE");
    
    if (!auth) {
      console.error("[AuthProvider] Firebase Auth is not initialized! Check environment variables.");
      console.error("[AuthProvider] Required env vars:", {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Set" : "MISSING",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "Set" : "MISSING",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "Set" : "MISSING"
      });
      setAuthInitializing(false);
      return;
    }
    
    setAuthInitializing(true); // Reset loading state

    // Check for redirect result (Safari redirect flow)
    checkRedirectResult(auth).then(async (redirectResult) => {
      if (redirectResult) {
        console.log("[AuthProvider] Redirect result found:", redirectResult.user.uid);
        // Let onAuthStateChanged handle the user update
      }
    }).catch(error => {
      console.error("[AuthProvider] Error checking redirect result:", error);
    });

    // Add a timeout to ensure auth initialization doesn't hang indefinitely
    const timeoutId = setTimeout(() => {
      console.warn("[AuthProvider] Auth state listener timeout - forcing initialization to complete");
      setAuthInitializing(false);
    }, 5000); // 5 second timeout

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(timeoutId); // Clear timeout since auth state changed
      console.log(`[AuthProvider] onAuthStateChanged fired. New User: ${currentUser ? currentUser.uid : 'null'}. Current local user state: ${user ? user.uid : 'null'}`);
      setUser(currentUser);
      
      // If user is authenticated but we're on a fresh page load, ensure session exists
      if (currentUser && !user) {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log("[AuthProvider] Existing user detected, ensuring dev session...");
            
            const devResponse = await fetch('/api/auth/dev-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                user: {
                  uid: currentUser.uid,
                  email: currentUser.email
                }
              }),
            });
            
            if (devResponse.ok) {
              console.log("[AuthProvider] Development session ensured for existing user");
            }
          } else {
            const idToken = await currentUser.getIdToken();
            console.log("[AuthProvider] Existing user detected, ensuring session cookie...");
            
            const response = await fetch('/api/auth/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ idToken }),
            });
            
            if (response.ok) {
              console.log("[AuthProvider] Session cookie ensured for existing user");
            }
          }
        } catch (error) {
          console.error('[AuthProvider] Error ensuring session:', error);
        }
      }
      
      if (authInitializing) {
        setAuthInitializing(false);
        console.log("[AuthProvider] onAuthStateChanged: authInitializing set to false.");
      }
    }, (error) => {
      console.error("[AuthProvider] onAuthStateChanged error:", error);
      setAuthInitializing(false);
    });

    // getRedirectResult logic removed as it's for signInWithRedirect
    // setRedirectResultProcessing(false); // No longer processing redirect result

    return () => {
      console.log("[AuthProvider] useEffect cleanup: Unsubscribing onAuthStateChanged.");
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []); // Keep empty dependency array

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("[AuthProvider] signInWithGoogle: Firebase Auth is not initialized.");
      return;
    }
    
    console.log("[AuthProvider] signInWithGoogle called. Browser:", isSafari() ? 'Safari' : 'Other');
    setAuthInitializing(true); // Set loading state
    
    try {
      // Use Safari-aware authentication
      const result = await safariAwareGoogleSignIn(auth);
      
      if (!result) {
        console.log("[AuthProvider] No result from Safari-aware sign-in (likely redirect flow)");
        // For redirect flow, the page will reload and useEffect will handle the result
        return;
      }
      
      console.log("[AuthProvider] Authentication successful. User:", result.user.uid);
      
      // Create session cookie on the server
      try {
        // In development, use simpler session management
        if (process.env.NODE_ENV === 'development') {
          console.log("[AuthProvider] Development mode - creating dev session...");
          
          const devResponse = await fetch('/api/auth/dev-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              user: {
                uid: result.user.uid,
                email: result.user.email
              }
            }),
          });
          
          if (devResponse.ok) {
            const devData = await devResponse.json();
            console.log("[AuthProvider] Development session created successfully:", devData);
          }
        } else {
          // Production: use Firebase Admin session cookies
          const idToken = await result.user.getIdToken();
          console.log("[AuthProvider] Got ID token, creating session cookie...");
          
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to create session');
          }
          
          const data = await response.json();
          console.log("[AuthProvider] Session cookie created successfully:", data);
        }
        
        // onAuthStateChanged will handle setting the user
      } catch (sessionError) {
        console.error('[AuthProvider] Error creating session cookie:', sessionError);
        // Continue anyway - client auth still works
      }
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
      // Clear session cookie on server
      try {
        if (process.env.NODE_ENV === 'development') {
          await fetch('/api/auth/dev-session', {
            method: 'DELETE',
          });
          console.log("[AuthProvider] Development session cleared.");
        } else {
          await fetch('/api/auth/session', {
            method: 'DELETE',
          });
          console.log("[AuthProvider] Session cookie cleared.");
        }
      } catch (sessionError) {
        console.error('[AuthProvider] Error clearing session cookie:', sessionError);
      }
      
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
