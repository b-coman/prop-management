import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/SimpleAuthContext';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * AuthProvider is mounted here rather than in the root layout so that the
 * Firebase Auth SDK loads only where somebody actually signs in. It used to sit
 * in the root layout, which meant every guest viewing the chalet downloaded the
 * Auth SDK and made an identitytoolkit + securetoken round trip for no reason.
 *
 * The redirect sign-in flow returns to this route, so getRedirectResult() in
 * AuthProvider still runs on the page that needs it.
 */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
