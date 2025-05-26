// Force Node.js runtime for admin auth check
export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
// Import from Node.js-specific auth helpers
import { getAuthUser } from '@/lib/auth-helpers';

/**
 * Server Component for checking admin authentication
 *
 * This component:
 * 1. Checks if the user is authenticated with the server
 * 2. Verifies the user has admin privileges
 * 3. Redirects to login if not authenticated
 * 4. Renders the children if authenticated and authorized
 */
export async function AdminAuthCheck({
  children
}: {
  children: React.ReactNode
}) {
  // IMPORTANT: Authentication is bypassed in development for convenience
  // This is intentionally different from production where auth is strictly enforced
  // Make sure to test authentication flows before deploying to production!
  if (process.env.NODE_ENV === 'development') {
    console.log('🔓 [AdminAuthCheck] Development mode - bypassing authentication');
    return <>{children}</>;
  }

  // Get the user from the cookie
  const cookieStore = cookies();
  const authData = await getAuthUser(cookieStore);

  // Check if user is authenticated
  if (!authData.authenticated) {
    // Redirect to login page
    redirect('/login?error=unauthenticated');
  }

  // Check if user is an admin
  if (!authData.admin) {
    // Redirect to unauthorized page
    redirect('/login?error=unauthorized');
  }

  // User is authenticated and authorized
  return <>{children}</>;
}