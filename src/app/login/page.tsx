// src/app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Inline SVG for Google icon
const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
        <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.5 512 0 401.5 0 265.5S110.5 19 244 19c70.5 0 132.5 29 176.5 76.5l-66 66C314.5 124.5 280.5 108 244 108c-54.5 0-103 42-115.5 96H24l22.5-66.5c29.5-80 105-133.5 197.5-133.5 50 0 93.5 16.5 126.5 46.5l66-66C390 25.5 320.5 0 244 0 109.5 0 0 111.5 0 257.5s109.5 257.5 244 257.5c129.5 0 227-84.5 241.5-198.5H244v-95h244z"></path>
    </svg>
);


export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.replace('/admin'); // Redirect to admin if already logged in
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is already defined (and not loading), they will be redirected by useEffect.
  // So, we only render the login form if user is null and not loading.
  if (user) {
    return null; // Or a loading/redirecting message
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription>Sign in to access the admin panel.</CardDescription>
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
              <GoogleIcon /> // Use the inline SVG component
            )}
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
