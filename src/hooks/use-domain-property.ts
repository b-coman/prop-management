// src/hooks/use-domain-property.ts
'use client';

import { useState, useEffect } from 'react';
import { resolveDomain, getCurrentDomain, isCustomDomain } from '@/lib/domain-utils';

interface UseDomainPropertyResult {
  propertySlug: string | null;
  propertyName: string | null;
  baseCurrency: string | null;
  isCustomDomain: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to get property information based on the current domain
 * Use this in client components where you need to know which property
 * corresponds to the current domain
 */
export function useDomainProperty(): UseDomainPropertyResult {
  const [result, setResult] = useState<UseDomainPropertyResult>({
    propertySlug: null,
    propertyName: null,
    baseCurrency: null,
    isCustomDomain: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const domain = getCurrentDomain();
    const customDomain = isCustomDomain(domain);
    
    // If not a custom domain, skip resolution
    if (!customDomain) {
      setResult({
        propertySlug: null,
        propertyName: null,
        baseCurrency: null,
        isCustomDomain: false,
        isLoading: false,
        error: null,
      });
      return;
    }
    
    // If we're on a custom domain, resolve it
    async function resolvePropertyDomain() {
      try {
        const resolved = await resolveDomain(domain);
        
        if (resolved) {
          setResult({
            propertySlug: resolved.slug,
            propertyName: resolved.name,
            baseCurrency: resolved.baseCurrency,
            isCustomDomain: true,
            isLoading: false,
            error: null,
          });
        } else {
          setResult({
            propertySlug: null,
            propertyName: null,
            baseCurrency: null,
            isCustomDomain: true,
            isLoading: false,
            error: new Error('Domain not found'),
          });
        }
      } catch (err) {
        setResult({
          propertySlug: null,
          propertyName: null,
          baseCurrency: null,
          isCustomDomain: true,
          isLoading: false,
          error: err instanceof Error ? err : new Error('Unknown error'),
        });
      }
    }
    
    resolvePropertyDomain();
  }, []);
  
  return result;
}