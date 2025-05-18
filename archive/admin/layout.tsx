// src/app/admin/layout.tsx
'use client';

import { type ReactNode, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, LayoutDashboard, Building, Ticket, MessageSquare, CalendarCheck } from 'lucide-react'; // Added CalendarCheck

// Inner component to handle auth logic
function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Log initial state
    console.log(`[ProtectedAdminLayout] useEffect initial check. Loading: ${loading}, User: ${user ? user.uid : 'null'}`);

    // Redirect if not loading and not authenticated
    if (!loading && !user) {
      console.log("[ProtectedAdminLayout] Not loading and no user found. Redirecting to /login.");
      router.replace('/login');
    } else if (!loading && user) {
       console.log("[ProtectedAdminLayout] User is authenticated. Proceeding.");
    } else {
       console.log("[ProtectedAdminLayout] Still loading authentication state...");
    }
  }, [user, loading, router]); // Add dependencies

  if (loading) {
    console.log("[ProtectedAdminLayout] Rendering loading indicator.");
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading admin area...</p>
      </div>
    );
  }

  if (!user) {
     console.log("[ProtectedAdminLayout] Rendering redirecting indicator (should be brief).");
     // If user is null after loading, redirect happens in the effect
     // Return a minimal loading state while redirect happens
     return (
         <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Redirecting...</p>
        </div>
    );
  }

  // Only render the protected layout if user is authenticated
  console.log("[ProtectedAdminLayout] Rendering protected admin content.");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/admin" className="text-lg font-semibold text-primary flex items-center">
            <LayoutDashboard className="mr-2 h-5 w-5" /> {/* Added Dashboard Icon */}
            RentalSpot Admin
          </Link>
          <nav className="flex items-center gap-4">
             {/* Links */}
            <Link href="/admin/properties" className="text-sm hover:underline flex items-center">
               <Building className="mr-1 h-4 w-4" /> Properties
            </Link>
             <Link href="/admin/bookings" className="text-sm hover:underline flex items-center">
                <CalendarCheck className="mr-1 h-4 w-4" /> Bookings
            </Link>
             <Link href="/admin/coupons" className="text-sm hover:underline flex items-center">
               <Ticket className="mr-1 h-4 w-4" /> Coupons
            </Link>
            <Link href="/admin/inquiries" className="text-sm hover:underline flex items-center">
               <MessageSquare className="mr-1 h-4 w-4" /> Inquiries
            </Link>
            {/* Logout Button */}
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3 text-muted-foreground">Loading...</p></div>}>
        <ProtectedAdminLayout>{children}</ProtectedAdminLayout>
    </Suspense>
  );
}