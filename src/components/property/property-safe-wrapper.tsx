"use client";

import { useEffect, useState } from 'react';
import { PropertyPageRenderer } from './property-page-renderer';
import { ErrorBoundary } from '@/components/error-boundary';

export function PropertySafeWrapper(props: any) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center">Loading property...</div>;
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 m-4 bg-red-50 border border-red-100 rounded-md">
          <h2 className="text-xl font-bold text-red-700">Property Rendering Error</h2>
          <p className="text-sm text-red-600 mt-1">
            There was an error rendering this property page. Please try refreshing the page.
          </p>
          <div className="mt-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      }
    >
      <PropertyPageRenderer {...props} />
    </ErrorBoundary>
  );
}