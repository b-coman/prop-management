'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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
}

const PropertySelectorContext = createContext<PropertySelectorContextType | undefined>(undefined);

// Pages that need propertyId in the URL (server components reading searchParams)
const URL_PROPERTY_PAGES = ['/admin/pricing', '/admin/calendar'];

interface Props {
  children: ReactNode;
  properties: SelectorProperty[];
  initialPropertyId: string | null;
}

export function PropertySelectorProvider({ children, properties, initialPropertyId }: Props) {
  // Validate initial property is in the list
  const validInitial = properties.some(p => p.id === initialPropertyId) ? initialPropertyId : null;
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string | null>(validInitial);
  const router = useRouter();
  const pathname = usePathname();

  const setSelectedProperty = useCallback((propertyId: string | null) => {
    setSelectedPropertyIdState(propertyId);

    // Persist to cookie (same pattern as sidebar_state)
    const cookieValue = propertyId || '';
    document.cookie = `selected_property=${cookieValue};path=/;max-age=${7 * 24 * 60 * 60}`;

    // For pages that need propertyId in URL, navigate with query param
    const needsUrlParam = URL_PROPERTY_PAGES.some(p => pathname.startsWith(p));
    if (needsUrlParam) {
      if (propertyId) {
        router.push(`${pathname}?propertyId=${propertyId}`);
      } else {
        router.push(pathname);
      }
    }
  }, [pathname, router]);

  return (
    <PropertySelectorContext.Provider value={{ properties, selectedPropertyId, setSelectedProperty }}>
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
