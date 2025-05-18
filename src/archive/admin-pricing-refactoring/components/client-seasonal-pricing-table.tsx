'use client';

import { SeasonalPricing } from '@/lib/server/pricing-data';
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
import { toggleSeasonalPricingStatus } from '../actions-client';

interface ClientSeasonalPricingTableProps {
  seasonalPricing: SeasonalPricing[];
  propertyId: string;
  isLoading: boolean;
  error: string | null;
}

// Define the colors for different season types
const SEASON_TYPE_COLORS = {
  'minimum': 'bg-blue-100 text-blue-800',
  'low': 'bg-green-100 text-green-800',
  'standard': 'bg-slate-100 text-slate-800',
  'medium': 'bg-yellow-100 text-yellow-800',
  'high': 'bg-orange-100 text-orange-800',
};

/**
 * Client component for displaying and interacting with seasonal pricing data
 * 
 * This component:
 * 1. Displays seasonal pricing data in a table
 * 2. Provides UI for enabling/disabling pricing rules
 * 3. Provides navigation to create new pricing rules
 */
export function ClientSeasonalPricingTable({
  seasonalPricing,
  propertyId,
  isLoading,
  error
}: ClientSeasonalPricingTableProps) {
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

  // Handle status change
  const handleStatusChange = async (seasonId: string, enabled: boolean) => {
    // Update local state immediately for UI responsiveness
    setPendingStatusChanges(prev => ({ ...prev, [seasonId]: true }));
    
    try {
      await toggleSeasonalPricingStatus(seasonId, enabled);
      router.refresh(); // Refresh the page to get updated data
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setPendingStatusChanges(prev => ({ ...prev, [seasonId]: false }));
    }
  };

  if (isLoading) {
    return <div className="py-6 text-center text-slate-500">Loading seasonal pricing...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  if (seasonalPricing.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-slate-500 mb-4">No seasonal pricing rules defined for this property</p>
        <Button onClick={() => router.push(`/admin/pricing/seasons/new?propertyId=${propertyId}`)}>
          Create First Season
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Date Range</TableHead>
          <TableHead>Price Multiplier</TableHead>
          <TableHead>Min. Stay</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {seasonalPricing.map((season) => (
          <TableRow key={season.id}>
            <TableCell className="font-medium">{season.name}</TableCell>
            <TableCell>
              <Badge className={SEASON_TYPE_COLORS[season.seasonType]}>
                {season.seasonType.charAt(0).toUpperCase() + season.seasonType.slice(1)}
              </Badge>
            </TableCell>
            <TableCell>
              {formatDate(season.startDate)} - {formatDate(season.endDate)}
            </TableCell>
            <TableCell>
              {season.priceMultiplier > 1 ? '+' : ''}
              {((season.priceMultiplier - 1) * 100).toFixed(0)}%
            </TableCell>
            <TableCell>{season.minimumStay || 1} night{season.minimumStay !== 1 ? 's' : ''}</TableCell>
            <TableCell>
              <div className="flex items-center">
                <Switch
                  checked={season.enabled}
                  disabled={!!pendingStatusChanges[season.id]}
                  onCheckedChange={(checked) => handleStatusChange(season.id, checked)}
                />
                {pendingStatusChanges[season.id] && (
                  <span className="ml-2 text-xs text-slate-500">Saving...</span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}