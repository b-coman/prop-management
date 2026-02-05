// src/components/admin/AdminPage.tsx
// Standard page template for admin sections

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdminPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AdminPage({
  title,
  description,
  actions,
  children,
  className,
}: AdminPageProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
