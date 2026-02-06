'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';

/**
 * Invisible component that syncs the property selector context with URL searchParams.
 * Place on pages where the server component reads `searchParams.propertyId`.
 */
export function PropertyUrlSync() {
  const { selectedPropertyId, setSelectedProperty } = usePropertySelector();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlPropertyId = searchParams.get('propertyId');

  useEffect(() => {
    // URL param overrides context (direct URL access, back-navigation)
    if (urlPropertyId && urlPropertyId !== selectedPropertyId) {
      setSelectedProperty(urlPropertyId);
      return;
    }

    // Context has a value but URL doesn't — add it to URL
    if (selectedPropertyId && !urlPropertyId) {
      router.replace(`${pathname}?propertyId=${selectedPropertyId}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  return null;
}
