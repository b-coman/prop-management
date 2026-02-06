'use client';

import { type ReactNode } from 'react';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { cn } from '@/lib/utils';

export function AdminContentWrapper({ children }: { children: ReactNode }) {
  const { isPending } = usePropertySelector();

  return (
    <div
      className={cn(
        'transition-opacity duration-150',
        isPending && 'opacity-50 pointer-events-none'
      )}
    >
      {children}
    </div>
  );
}
