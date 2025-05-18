// src/app/admin/layout.tsx
// Force Node.js runtime for the entire admin section
export const runtime = 'nodejs';
import { type ReactNode, Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Button } from '@/components/ui/button';
import { Loader2, LayoutDashboard, Building, Ticket, MessageSquare, CalendarCheck } from 'lucide-react';
import { AdminAuthCheck } from './AdminAuthCheck';
import { ClientAdminNavbar } from './_components/ClientAdminNavbar';

/**
 * Server-side admin layout with authentication check
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <AdminAuthCheck>
      <div className="flex min-h-screen flex-col">
        <ClientAdminNavbar />

        {isDevelopment && (
          <div className="bg-amber-500 text-amber-950 text-xs text-center py-1">
            Development Mode - Authentication Bypassed
          </div>
        )}

        <main className="flex-grow container mx-auto py-8">
          <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading...</p>
            </div>
          }>
            {children}
          </Suspense>
        </main>

        <footer className="border-t bg-muted/50">
          <div className="container py-4 text-center text-xs text-muted-foreground">
            RentalSpot Admin Panel &copy; {new Date().getFullYear()}
            {isDevelopment && (
              <span className="ml-2 text-amber-600 font-medium">Development Mode</span>
            )}
          </div>
        </footer>
      </div>
    </AdminAuthCheck>
  );
}