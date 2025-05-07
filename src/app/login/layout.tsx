// src/app/login/layout.tsx
import type { ReactNode, Suspense } from 'react';
// AuthProvider removed, as it's now in the root layout
import { Loader2 } from 'lucide-react';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    // AuthProvider is no longer needed here
    // Suspense can be added here if children might suspend, though less common for a simple login page
    // For example:
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      {children}
    </Suspense>
  );
}
