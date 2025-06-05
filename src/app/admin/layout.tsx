/**
 * @fileoverview Simple admin layout with authentication
 * @module app/admin-simple/layout
 * 
 * @description
 * Clean admin layout with simple authentication protection.
 */

import { ReactNode } from 'react';
import { SimpleAdminAuth } from '@/components/SimpleAdminAuth';
import { ClientAdminNavbar } from './_components/ClientAdminNavbar';
import { checkAuthentication } from '@/lib/simple-auth-helpers';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function SimpleAdminLayout({ children }: AdminLayoutProps) {
  // Get auth status for display
  const authResult = await checkAuthentication();
  
  return (
    <SimpleAdminAuth>
      <div className="flex min-h-screen flex-col">
        {/* Navigation */}
        <ClientAdminNavbar />

        {/* Environment indicator */}
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="container mx-auto">
            <p className="text-sm text-blue-800">
              ✅ Simple Authentication Active
              {authResult.environment && (
                <span className="ml-2 text-xs">({authResult.environment})</span>
              )}
            </p>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-grow container mx-auto py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t bg-muted/50">
          <div className="container mx-auto py-4 text-center text-xs text-muted-foreground">
            RentalSpot Admin Panel &copy; {new Date().getFullYear()}
            <span className="ml-2 text-green-600 font-medium">
              Simple Auth v2.0
            </span>
          </div>
        </footer>
      </div>
    </SimpleAdminAuth>
  );
}