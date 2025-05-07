// src/app/admin/layout.tsx
'use client';

import { type ReactNode, Suspense } from 'react'; // Suspense for potential Next.js features
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext'; // AuthProvider is removed, useAuth consumes from root
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';

// Inner component to handle auth logic
function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  console.log(`[ProtectedAdminLayout] Render. Loading: ${loading}, User: ${user ? user.uid : null}`);


  if (loading) {
     console.log("[ProtectedAdminLayout] Rendering: Loading state (loading is true).");
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading admin area...</p>
      </div>
    );
  }

  if (!user) {
    console.log("[ProtectedAdminLayout] No user (loading is false), redirecting to /login...");
    // Use replace to avoid adding the admin route to browser history if user isn't logged in
    router.replace('/login');
    return (
         <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Redirecting to login...</p>
        </div>
    ); // Render loader while redirecting
  }

  // User is authenticated, render admin layout
   console.log("[ProtectedAdminLayout] Rendering: Admin content (loading false, user exists).");
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


// Main AdminLayout component now directly uses ProtectedAdminLayout
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    // AuthProvider is no longer needed here, it's in the root layout
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3 text-muted-foreground">Loading...</p></div>}>
        <ProtectedAdminLayout>{children}</ProtectedAdminLayout>
    </Suspense>
  );
}
