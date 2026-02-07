'use client';

import { useState } from 'react';
import type { Guest } from '@/types';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { GuestTable } from './guest-table';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { backfillGuestsAction } from '../actions';

interface GuestsWithFilterProps {
  guests: Guest[];
  isSuperAdmin: boolean;
}

export function GuestsWithFilter({ guests, isSuperAdmin }: GuestsWithFilterProps) {
  const { selectedPropertyId } = usePropertySelector();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  let filtered = guests;
  if (selectedPropertyId) {
    filtered = filtered.filter((g) =>
      g.propertyIds?.includes(selectedPropertyId)
    );
  }

  const handleBackfill = async () => {
    setIsBackfilling(true);
    setBackfillResult(null);
    try {
      const result = await backfillGuestsAction();
      if (result.success) {
        setBackfillResult(
          `Backfill complete: ${result.processed} bookings processed, ${result.created} guests created, ${result.updated} updated.`
        );
      } else {
        setBackfillResult(`Error: ${result.error}`);
      }
    } catch {
      setBackfillResult('Backfill failed unexpectedly.');
    }
    setIsBackfilling(false);
  };

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackfill}
            disabled={isBackfilling}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-spin' : ''}`} />
            {isBackfilling ? 'Backfilling...' : 'Backfill from Bookings'}
          </Button>
          {backfillResult && (
            <p className="text-sm text-muted-foreground">{backfillResult}</p>
          )}
        </div>
      )}

      <GuestTable guests={filtered} />
    </div>
  );
}
