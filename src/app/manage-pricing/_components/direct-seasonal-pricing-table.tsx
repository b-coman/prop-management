'use client';

import { useDirectSeasonalPricing } from '../direct-data';
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

const SEASON_TYPE_COLORS = {
  'minimum': 'bg-blue-100 text-blue-800',
  'low': 'bg-green-100 text-green-800',
  'standard': 'bg-slate-100 text-slate-800',
  'medium': 'bg-yellow-100 text-yellow-800',
  'high': 'bg-orange-100 text-orange-800',
};

interface DirectSeasonalPricingTableProps {
  propertyId: string;
}

export default function DirectSeasonalPricingTable({ propertyId }: DirectSeasonalPricingTableProps) {
  const router = useRouter();
  const { seasons, loading, error } = useDirectSeasonalPricing(propertyId);
  
  // Format date string
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return <div className="py-6 text-center text-slate-500">Loading seasonal pricing...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  if (seasons.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-slate-500 mb-4">No seasonal pricing rules defined for this property</p>
        <Button>Create First Season (Local Data Mode)</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-4 text-xs text-blue-700">
        Currently showing local test data. Changes won't persist.
      </div>
      
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
          {seasons.map((season) => (
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
                <Switch
                  checked={season.enabled}
                  onCheckedChange={() => {}} // No-op in local data mode
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}