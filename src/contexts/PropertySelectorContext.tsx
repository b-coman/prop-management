'use client';

import { createContext, useContext, useState, useCallback, useTransition, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface SelectorProperty {
  id: string;
  name: string | { en?: string; ro?: string };
  status: string;
}

interface PropertySelectorContextType {
  properties: SelectorProperty[];
  selectedPropertyId: string | null;
  setSelectedProperty: (propertyId: string | null) => void;
  isPending: boolean;
}

const PropertySelectorContext = createContext<PropertySelectorContextType | undefined>(undefined);

// Pages that need propertyId in the URL (server components reading searchParams)
const URL_PROPERTY_PAGES = ['/admin/pricing', '/admin/calendar', '/admin/website', '/admin/website/navigation', '/admin/website/settings', '/admin/housekeeping'];

interface Props {
  children: ReactNode;
  properties: SelectorProperty[];
  initialPropertyId: string | null;
}

export function PropertySelectorProvider({ children, properties, initialPropertyId }: Props) {
  // Validate initial property is in the list
  const validInitial = properties.some(p => p.id === initialPropertyId) ? initialPropertyId : null;
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string | null>(validInitial);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const setSelectedProperty = useCallback((propertyId: string | null) => {
    setSelectedPropertyIdState(propertyId);

    // Persist to cookie (same pattern as sidebar_state)
    // Cookie write must be synchronous — server reads it during re-render
    const cookieValue = propertyId || '';
    document.cookie = `selected_property=${cookieValue};path=/;max-age=${7 * 24 * 60 * 60}`;

    // For pages that need propertyId in URL, navigate with query param
    // Wrapped in startTransition to keep current content visible during load
    const needsUrlParam = URL_PROPERTY_PAGES.some(p => pathname.startsWith(p));
    if (needsUrlParam) {
      startTransition(() => {
        if (propertyId) {
          router.push(`${pathname}?propertyId=${propertyId}`);
        } else {
          router.push(pathname);
        }
      });
    }
  }, [pathname, router, startTransition]);

  return (
    <PropertySelectorContext.Provider value={{ properties, selectedPropertyId, setSelectedProperty, isPending }}>
      {children}
    </PropertySelectorContext.Provider>
  );
}

export function usePropertySelector() {
  const context = useContext(PropertySelectorContext);
  if (context === undefined) {
    throw new Error('usePropertySelector must be used within a PropertySelectorProvider');
  }
  return context;
}
