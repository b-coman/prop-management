// src/components/admin/Breadcrumb.tsx
// Dynamic breadcrumb navigation for admin pages

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

// Map path segments to readable labels
const pathLabels: Record<string, string> = {
  admin: 'Admin',
  properties: 'Properties',
  bookings: 'Bookings',
  pricing: 'Pricing',
  coupons: 'Coupons',
  inquiries: 'Inquiries',
  new: 'New',
  edit: 'Edit',
  seasons: 'Seasons',
  'date-overrides': 'Date Overrides',
};

/**
 * Generate breadcrumb items from the current pathname
 */
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Skip if it's a dynamic ID (e.g., looks like a document ID)
    const isDynamicId = segment.length > 20 || /^[a-zA-Z0-9-_]{10,}$/.test(segment);

    if (isDynamicId && i === segments.length - 1) {
      // Last segment is an ID, add as "Details"
      items.push({ label: 'Details' });
    } else if (!isDynamicId) {
      const label = pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      const isLast = i === segments.length - 1;

      items.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    }
  }

  return items;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const pathname = usePathname();

  // Use provided items or generate from path
  const breadcrumbItems = items ?? generateBreadcrumbsFromPath(pathname);

  if (breadcrumbItems.length <= 1) {
    return null; // Don't show breadcrumb for top-level pages
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-sm text-muted-foreground', className)}
    >
      <ol className="flex items-center gap-1">
        <li>
          <Link
            href="/admin"
            className="flex items-center hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Admin Home</span>
          </Link>
        </li>
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
