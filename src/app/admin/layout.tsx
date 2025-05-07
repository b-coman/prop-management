// src/app/admin/layout.tsx
'use client';

import { type ReactNode, Suspense } from 'react'; // Suspense for potential Next.js features
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation'; 
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';

// Inner component to handle auth logic, so AuthProvider wraps it
function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  console.log("[ProtectedAdminLayout] User:", user ? user.uid : null, "Loading:", loading);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading admin area...</p>
      </div>
    );
  }

  if (!user) {
    console.log("[ProtectedAdminLayout] No user, redirecting to /login");
    router.replace('/login'); 
    return (
         <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Redirecting to login...</p>
        </div>
    ); // Render loader while redirecting
  }

  // User is authenticated, render admin layout
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/admin" className="text-lg font-semibold text-primary">
            RentalSpot Admin
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/admin/coupons" className="text-sm hover:underline">
              Manage Coupons
            </Link>
            <Link href="/admin/coupons/new" className="text-sm hover:underline">
              Create Coupon
            </Link>
            {/* Add other admin navigation links here */}
            <Button onClick={logout} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-grow container mx-auto py-8">{children}</main>

      <footer className="border-t bg-muted/50">
        <div className="container py-4 text-center text-xs text-muted-foreground">
          RentalSpot Admin Panel &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}


// Main AdminLayout component wraps ProtectedAdminLayout with AuthProvider
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3 text-muted-foreground">Loading...</p></div>}>
            <ProtectedAdminLayout>{children}</ProtectedAdminLayout>
        </Suspense>
    </AuthProvider>
  );
}
