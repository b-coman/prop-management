'use client';

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataSourceCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

export function DataSourceCard({
  title,
  description,
  enabled,
  onToggle,
  children,
}: DataSourceCardProps) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              !enabled && '-rotate-90'
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      {enabled && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {children}
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" disabled className="gap-2">
              <FlaskConical className="h-3.5 w-3.5" />
              Test
              <span className="text-xs text-muted-foreground">(Coming soon)</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
