'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SeasonalPricing, SeasonType } from '@/lib/pricing/price-calculation';
import { getSeasonalPricing, updateSeasonalPricing, deleteSeasonalPricing } from '../actions';

const SEASON_TYPE_COLORS: Record<SeasonType, string> = {
  'minimum': 'bg-blue-100 text-blue-800',
  'low': 'bg-green-100 text-green-800',
  'standard': 'bg-slate-100 text-slate-800',
  'medium': 'bg-yellow-100 text-yellow-800',
  'high': 'bg-orange-100 text-orange-800',
};

interface SeasonalPricingTableProps {
  propertyId: string;
}

export default function SeasonalPricingTable({ propertyId }: SeasonalPricingTableProps) {
  const router = useRouter();
  const [seasons, setSeasons] = useState<SeasonalPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Load seasonal pricing on component mount or property change
  useEffect(() => {
    const loadSeasons = async () => {
      if (!propertyId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const result = await getSeasonalPricing(propertyId);
        
        if (result.success) {
          setSeasons(result.seasons);
        } else {
          setError(result.error || 'Failed to load seasonal pricing');
        }
      } catch (err) {
        console.error('Error loading seasonal pricing:', err);
        setError('An unexpected error occurred while loading seasonal pricing');
      } finally {
        setLoading(false);
      }
    };

    loadSeasons();
  }, [propertyId]);
  
  // Handle enabled toggle
  const handleEnabledToggle = async (id: string, currentValue: boolean) => {
    try {
      const result = await updateSeasonalPricing(id, { enabled: !currentValue });
      
      if (result.success) {
        // Update local state
        setSeasons(prevSeasons => prevSeasons.map(season => 
          season.id === id ? { ...season, enabled: !currentValue } : season
        ));
      } else {
        setError(result.error || 'Failed to update season');
      }
    } catch (err) {
      console.error('Error updating season:', err);
      setError('An unexpected error occurred while updating the season');
    }
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    
    try {
      const result = await deleteSeasonalPricing(deleteId);
      
      if (result.success) {
        // Update local state
        setSeasons(prevSeasons => prevSeasons.filter(season => season.id !== deleteId));
        setDeleteId(null);
      } else {
        setError(result.error || 'Failed to delete season');
      }
    } catch (err) {
      console.error('Error deleting season:', err);
      setError('An unexpected error occurred while deleting the season');
    }
  };
  
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
        <Button 
          onClick={() => router.push(`/admin/pricing/seasons/new?propertyId=${propertyId}`)}
        >
          Create First Season
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead>Price Multiplier</TableHead>
            <TableHead>Min. Stay</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                  onCheckedChange={() => handleEnabledToggle(season.id, season.enabled)}
                />
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/admin/pricing/seasons/edit/${season.id}`)}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => setDeleteId(season.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this seasonal pricing rule. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}