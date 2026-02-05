// src/components/admin/StatusBadge.tsx
// Reusable status badge component

import { Badge } from '@/components/ui/badge';
import { getStatusConfig, getStatusClasses } from '@/lib/admin/status-utils';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string | undefined | null;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = false }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(getStatusClasses(status), 'capitalize', className)}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
