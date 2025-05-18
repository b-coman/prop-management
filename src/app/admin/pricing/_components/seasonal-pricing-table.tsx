'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { toggleSeasonalPricingStatus } from '../server-actions-hybrid';

// Define the SeasonalPricing type
interface SeasonalPricing {
  id: string;
  propertyId: string;
  name: string;
  seasonType: 'minimum' | 'low' | 'standard' | 'medium' | 'high';
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay?: number;
  enabled: boolean;
}

interface SeasonalPricingTableProps {
  seasons: SeasonalPricing[];
  propertyId: string;
}

export function SeasonalPricingTable({ seasons, propertyId }: SeasonalPricingTableProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Function to convert date string to formatted date
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  // Function to get badge color based on season type
  const getSeasonBadge = (seasonType: string) => {
    switch (seasonType) {
      case 'minimum':
        return <Badge variant="outline" className="bg-slate-100">Minimum</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-blue-100">Low</Badge>;
      case 'standard':
        return <Badge variant="outline" className="bg-green-100">Standard</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-100">Medium</Badge>;
      case 'high':
        return <Badge variant="outline" className="bg-red-100">High</Badge>;
      default:
        return <Badge variant="outline">{seasonType}</Badge>;
    }
  };

  // Handle toggle season status
  const handleToggleStatus = async (seasonId: string, enabled: boolean) => {
    try {
      setIsUpdating(seasonId);
      await toggleSeasonalPricingStatus(seasonId, enabled);
      router.refresh(); // Refresh the page data
    } catch (error) {
      console.error('Error toggling season status:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  // Handle delete season
  const handleDeleteSeason = async (seasonId: string) => {
    const form = new FormData();
    form.append('id', seasonId);
    form.append('propertyId', propertyId);

    try {
      // Use the delete action
      const response = await fetch('/api/admin/pricing/delete-season', {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        throw new Error('Failed to delete season');
      }

      router.refresh(); // Refresh the page to get updated data
    } catch (error) {
      console.error('Error deleting season:', error);
      alert('Failed to delete season. Please try again.');
    }
  };

  // Handle edit season
  const handleEditSeason = (seasonId: string) => {
    router.push(`/admin/pricing/seasons/edit?seasonId=${seasonId}&propertyId=${propertyId}`);
  };

  if (seasons.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">No seasonal pricing defined for this property.</p>
        <Button 
          className="mt-4"
          onClick={() => router.push(`/admin/pricing/seasons/new?propertyId=${propertyId}`)}
        >
          Add Your First Season
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableCaption>Seasonal pricing rules for this property.</TableCaption>
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
            <TableCell>{getSeasonBadge(season.seasonType)}</TableCell>
            <TableCell>
              {formatDate(season.startDate)} - {formatDate(season.endDate)}
            </TableCell>
            <TableCell>
              {season.priceMultiplier.toFixed(2)}x
            </TableCell>
            <TableCell>{season.minimumStay || 1} nights</TableCell>
            <TableCell>
              <Switch
                checked={season.enabled}
                disabled={isUpdating === season.id}
                onCheckedChange={(checked) => handleToggleStatus(season.id, checked)}
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEditSeason(season.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Season</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this season? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDeleteSeason(season.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}