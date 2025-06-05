/**
 * @fileoverview Simple admin authentication component
 * @module components/SimpleAdminAuth
 * 
 * @description
 * Simple server component that protects admin routes.
 * Redirects to login if not authenticated.
 */

import { ReactNode } from 'react';
import { checkAdminAccess } from '@/lib/simple-auth-helpers';

interface SimpleAdminAuthProps {
  children: ReactNode;
}

/**
 * Simple admin authentication wrapper
 * Server component that checks authentication and redirects if needed
 */
export async function SimpleAdminAuth({ children }: SimpleAdminAuthProps) {
  // This will redirect to /login if not authenticated
  const user = await checkAdminAccess();
  
  console.log('[SimpleAdminAuth] Access granted to:', user.email);
  
  return <>{children}</>;
}