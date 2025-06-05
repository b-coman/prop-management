// src/app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { isSafari, isPopupBlocked } from '@/lib/safari-auth-fix';

// Inline SVG for Google icon
const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
        <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.5 512 0 401.5 0 265.5S110.5 19 244 19c70.5 0 132.5 29 176.5 76.5l-66 66C314.5 124.5 280.5 108 244 108c-54.5 0-103 42-115.5 96H24l22.5-66.5c29.5-80 105-133.5 197.5-133.5 50 0 93.5 16.5 126.5 46.5l66-66C390 25.5 320.5 0 244 0 109.5 0 0 111.5 0 257.5s109.5 257.5 244 257.5c129.5 0 227-84.5 241.5-198.5H244v-95h244z"></path>
    </svg>
);


export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();
  const [browserInfo, setBrowserInfo] = useState({ isSafari: false, popupBlocked: false });

  console.log(`[LoginPage] Render. Auth Loading: ${loading}, User: ${user ? user.uid : 'null'}`);

  useEffect(() => {
    // Check browser capabilities
    setBrowserInfo({
      isSafari: isSafari(),
      popupBlocked: isPopupBlocked()
    });
  }, []);

  useEffect(() => {
    console.log(`[LoginPage] useEffect triggered. Auth Loading: ${loading}, User: ${user ? user.uid : 'null'}`);
    if (!loading) {
      if (user) {
        console.log("[LoginPage] User authenticated, redirecting to /admin...");
        router.replace('/admin');
      } else {
        console.log("[LoginPage] User not authenticated after loading complete. Displaying login form.");
      }
    } else {
      console.log("[LoginPage] Still loading auth state (AuthContext loading is true)...");
    }
  }, [user, loading, router]);

  if (loading) {
    console.log("[LoginPage] Rendering: Loading indicator (AuthContext loading is true).");
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Authenticating, please wait...</p>
      </div>
    );
  }

  if (!user) {
    console.log("[LoginPage] Rendering: Login form (AuthContext loading false, user is null).");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
            <CardDescription>Sign in to access the admin panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {browserInfo.isSafari && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Safari User</p>
                    <p>You'll be redirected to Google for secure authentication, then brought back here.</p>
                  </div>
                </div>
              </div>
            )}
            
            <Button
              onClick={signInWithGoogle}
              className="w-full"
              disabled={loading} 
              variant="outline"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback for the brief moment user is set but redirect hasn't happened yet (should be rare with replace)
  console.log("[LoginPage] Rendering: Redirecting indicator (AuthContext loading false, user exists, waiting for useEffect).");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-3 text-muted-foreground">Redirecting to admin panel...</p>
    </div>
  );
}
