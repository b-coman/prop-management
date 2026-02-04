/**
 * @fileoverview Simple login page
 * @module app/login-simple
 * 
 * @description
 * Clean, simple login page that works universally across all browsers.
 * Uses redirect-only flow to avoid popup issues.
 */

'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/SimpleAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Google icon component
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.5 512 0 401.5 0 265.5S110.5 19 244 19c70.5 0 132.5 29 176.5 76.5l-66 66C314.5 124.5 280.5 108 244 108c-54.5 0-103 42-115.5 96H24l22.5-66.5c29.5-80 105-133.5 197.5-133.5 50 0 93.5 16.5 126.5 46.5l66-66C390 25.5 320.5 0 244 0 109.5 0 0 111.5 0 257.5s109.5 257.5 244 257.5c129.5 0 227-84.5 241.5-198.5H244v-95h244z"/>
  </svg>
);

export default function SimpleLoginPage() {
  const { user, loading, signingIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  console.log('[SimpleLogin] Render - loading:', loading, 'signingIn:', signingIn, 'user:', user?.email || 'null');

  useEffect(() => {
    // Don't auto-redirect while signing in - the sign-in handler will redirect
    if (!loading && !signingIn && user) {
      console.log('[SimpleLogin] User authenticated, redirecting to admin');
      router.push('/admin');
    }
  }, [loading, signingIn, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription>
            Sign in to access the admin panel.
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              You will be redirected to Google for authentication.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Universal authentication - works on all browsers
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}