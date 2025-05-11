// src/lib/domain-utils.ts
import { cache } from 'react';

// Interface for the domain resolution result
interface DomainResolutionResult {
  slug: string;
  name: string;
  baseCurrency: string;
}

// Cache the domain resolution to avoid multiple calls
export const resolveDomain = cache(async (domain: string): Promise<DomainResolutionResult | null> => {
  try {
    // Skip API call for localhost
    if (domain.includes('localhost')) {
      return null;
    }

    // Call our API endpoint to resolve the domain
    const response = await fetch(`/api/resolve-domain?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Don't cache this request
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Domain not found, but not an error
        return null;
      }
      throw new Error(`Failed to resolve domain: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      slug: data.slug,
      name: data.name,
      baseCurrency: data.baseCurrency,
    };
  } catch (error) {
    console.error('Error resolving domain:', error);
    return null;
  }
});

// Helper to get the current hostname from the browser
export function getCurrentDomain(): string {
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return '';
}

// Helper to check if we're on a custom domain
export function isCustomDomain(domain: string): boolean {
  // Skip for localhost and development domains
  if (
    domain.includes('localhost') ||
    domain.includes('127.0.0.1') ||
    domain.includes('vercel.app') ||
    domain.includes('cloudworkstations.dev')
  ) {
    return false;
  }
  
  // Check against our main domain (should be in env)
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'example.com';
  return domain !== mainDomain;
}

// Helper to construct property URLs based on the current domain
export function getPropertyUrl(slug: string, page?: string): string {
  const domain = getCurrentDomain();
  
  if (isCustomDomain(domain)) {
    // On a custom domain, we can use relative paths
    if (!page || page === 'homepage') {
      return '/';
    }
    return `/${page}`;
  }
  
  // On the main domain, we need to use the full property path
  if (!page || page === 'homepage') {
    return `/properties/${slug}`;
  }
  return `/properties/${slug}/${page}`;
}