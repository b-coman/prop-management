"use client";

import { lazy, Suspense, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the actual CurrencyProvider
const CurrencyProvider = lazy(() => 
  import('./CurrencyContext').then(module => ({ 
    default: module.CurrencyProvider 
  }))
);

// Loading fallback component
function CurrencyLoadingFallback({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-gray-600">Loading currency data...</span>
        </div>
      </div>
    </>
  );
}

// Optimized wrapper that lazy loads the CurrencyProvider
export function OptimizedCurrencyProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<CurrencyLoadingFallback>{children}</CurrencyLoadingFallback>}>
      <CurrencyProvider>{children}</CurrencyProvider>
    </Suspense>
  );
}