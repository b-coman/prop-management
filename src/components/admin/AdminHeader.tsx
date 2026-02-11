// src/components/admin/AdminHeader.tsx
// Admin header with sidebar trigger and breadcrumb

'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb } from './Breadcrumb';

interface AdminHeaderProps {
  environment?: string;
}

export function AdminHeader({ environment }: AdminHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb />

      <div className="ml-auto flex items-center gap-2">
        {environment && environment !== 'production' && environment !== 'production-fallback' && (
          <span className="text-xs text-muted-foreground">
            {environment}
          </span>
        )}
      </div>
    </header>
  );
}
