/**
 * @fileoverview Simple admin authentication component
 * @module components/SimpleAdminAuth
 *
 * @description
 * Simple server component that protects admin routes.
 * Redirects to login if not authenticated or not authorized.
 */

import { ReactNode } from 'react';
import { requireAdminAccess } from '@/lib/simple-auth-helpers';
import { loggers } from '@/lib/logger';

const logger = loggers.authorization;

interface SimpleAdminAuthProps {
  children: ReactNode;
}

/**
 * Simple admin authentication wrapper
 * Server component that checks authentication and authorization, redirects if needed
 */
export async function SimpleAdminAuth({ children }: SimpleAdminAuthProps) {
  // This will redirect to /login if not authenticated or not authorized
  const user = await requireAdminAccess();

  logger.debug('Admin access granted', { email: user.email, role: user.role });

  return <>{children}</>;
}