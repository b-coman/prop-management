/**
 * @fileoverview DEPRECATED: Safe Search Params Hook
 * @module lib/language-system/safe-search-params
 * @file-status: DEPRECATED - No longer needed after language system migration
 * 
 * @description
 * DEPRECATED: This file was used for search params-based language detection.
 * The language system now uses path-based detection exclusively. 
 * This file is kept for compatibility but should not be used in new code.
 * 
 * @migration-path: Use path-based language detection via URLs like /booking/check/slug/ro
 * @removal-date: After all dependencies are confirmed migrated
 */

import { useEffect, useState } from 'react';

/**
 * @deprecated Use path-based language detection instead of search params
 * Safe hook to get search params without Suspense requirement
 */
export function useSafeSearchParams(): URLSearchParams | null {
  console.warn('useSafeSearchParams is deprecated. Use path-based language detection instead.');
  
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  
  useEffect(() => {
    // Only access window on client side
    if (typeof window !== 'undefined') {
      setSearchParams(new URLSearchParams(window.location.search));
    }
  }, []);
  
  return searchParams;
}

/**
 * @deprecated Use path-based language detection instead of search params
 * Get search params from window directly (client-side only)
 */
export function getClientSearchParams(): URLSearchParams | null {
  console.warn('getClientSearchParams is deprecated. Use path-based language detection instead.');
  
  if (typeof window === 'undefined') return null;
  
  try {
    return new URLSearchParams(window.location.search);
  } catch (error) {
    return null;
  }
}