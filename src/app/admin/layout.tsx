/**
 * @fileoverview Admin layout with sidebar navigation
 * @module app/admin/layout
 *
 * @description
 * Admin layout with collapsible sidebar, breadcrumb navigation,
 * and authentication protection.
 */

import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { SimpleAdminAuth } from '@/components/SimpleAdminAuth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminContentWrapper } from '@/components/admin/AdminContentWrapper';
import { checkAuthentication } from '@/lib/simple-auth-helpers';
import { cookies } from 'next/headers';
import { fetchAdminProperties } from './_actions';
import { PropertySelectorProvider } from '@/contexts/PropertySelectorContext';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Get auth status for display
  const authResult = await checkAuthentication();

  // Get sidebar state and selected property from cookies
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get('sidebar_state')?.value;
  const defaultOpen = sidebarState !== 'false';
  const selectedProperty = cookieStore.get('selected_property')?.value || null;

  // Fetch properties for the global selector
  const properties = await fetchAdminProperties();

  return (
    <SimpleAdminAuth>
      <PropertySelectorProvider properties={properties} initialPropertyId={selectedProperty}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AdminSidebar />
        <SidebarInset>
          <AdminHeader environment={authResult.environment} />

          {/* Main content */}
          <main className="flex-1 p-6">
            <AdminContentWrapper>
              {children}
            </AdminContentWrapper>
          </main>

          {/* Footer */}
          <footer className="border-t bg-muted/50">
            <div className="py-4 px-6 text-center text-xs text-muted-foreground">
              RentalSpot Admin Panel &copy; {new Date().getFullYear()}
            </div>
          </footer>
        </SidebarInset>
        </SidebarProvider>
      </PropertySelectorProvider>
    </SimpleAdminAuth>
  );
}