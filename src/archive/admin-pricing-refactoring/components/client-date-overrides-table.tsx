'use client';

import { DateOverride } from '@/lib/server/pricing-data';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toggleDateOverrideAvailability } from '../actions-client';

interface ClientDateOverridesTableProps {
  dateOverrides: DateOverride[];
  propertyId: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Client component for displaying and interacting with date overrides
 * 
 * This component:
 * 1. Displays date override data in a table
 * 2. Provides UI for enabling/disabling date overrides
 * 3. Provides navigation to create new date overrides
 */
export function ClientDateOverridesTable({
  dateOverrides,
  propertyId,
  isLoading,
  error
}: ClientDateOverridesTableProps) {
  const router = useRouter();
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Record<string, boolean>>({});
  
  // Format date string
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Handle availability change
  const handleAvailabilityChange = async (overrideId: string, available: boolean) => {
    // Update local state immediately for UI responsiveness
    setPendingStatusChanges(prev => ({ ...prev, [overrideId]: true }));
    
    try {
      await toggleDateOverrideAvailability(overrideId, available);
      router.refresh(); // Refresh the page to get updated data
    } catch (error) {
      console.error('Error toggling availability:', error);
    } finally {
      setPendingStatusChanges(prev => ({ ...prev, [overrideId]: false }));
    }
  };

  if (isLoading) {
    return <div className="py-6 text-center text-slate-500">Loading date overrides...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  if (dateOverrides.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-slate-500 mb-4">No date overrides defined for this property</p>
        <Button onClick={() => router.push(`/admin/pricing/date-overrides/new?propertyId=${propertyId}`)}>
          Create First Date Override
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Custom Price</TableHead>
          <TableHead>Min. Stay</TableHead>
          <TableHead>Pricing</TableHead>
          <TableHead>Available</TableHead>
          <TableHead>Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dateOverrides.map((override) => (
          <TableRow key={override.id}>
            <TableCell className="font-medium">{formatDate(override.date)}</TableCell>
            <TableCell>{override.customPrice}</TableCell>
            <TableCell>{override.minimumStay || 1} night{override.minimumStay !== 1 ? 's' : ''}</TableCell>
            <TableCell>
              <Badge className={override.flatRate ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                {override.flatRate ? 'Flat Rate' : 'Per Person'}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center">
                <Switch
                  checked={override.available}
                  disabled={!!pendingStatusChanges[override.id]}
                  onCheckedChange={(checked) => handleAvailabilityChange(override.id, checked)}
                />
                {pendingStatusChanges[override.id] && (
                  <span className="ml-2 text-xs text-slate-500">Saving...</span>
                )}
              </div>
            </TableCell>
            <TableCell className="max-w-[200px] truncate" title={override.reason || ''}>
              {override.reason || '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}