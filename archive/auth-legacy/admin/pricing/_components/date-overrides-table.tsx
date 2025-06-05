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
import { toggleDateOverrideAvailability } from '../server-actions-hybrid';

// Define the DateOverride type
interface DateOverride {
  id: string;
  propertyId: string;
  date: string;
  customPrice: number;
  reason?: string;
  minimumStay?: number;
  available: boolean;
  flatRate: boolean;
}

interface DateOverridesTableProps {
  overrides: DateOverride[];
  propertyId: string;
}

export function DateOverridesTable({ overrides, propertyId }: DateOverridesTableProps) {
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

  // Handle toggle date availability
  const handleToggleAvailability = async (overrideId: string, available: boolean) => {
    try {
      setIsUpdating(overrideId);
      await toggleDateOverrideAvailability(overrideId, available);
      router.refresh(); // Refresh the page data
    } catch (error) {
      console.error('Error toggling date availability:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  // Handle delete override
  const handleDeleteOverride = async (overrideId: string) => {
    const form = new FormData();
    form.append('id', overrideId);
    form.append('propertyId', propertyId);

    try {
      // Use the delete action
      const response = await fetch('/api/admin/pricing/delete-override', {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        throw new Error('Failed to delete date override');
      }

      router.refresh(); // Refresh the page to get updated data
    } catch (error) {
      console.error('Error deleting date override:', error);
      alert('Failed to delete date override. Please try again.');
    }
  };

  // Handle edit override
  const handleEditOverride = (overrideId: string) => {
    router.push(`/admin/pricing/date-overrides/edit?overrideId=${overrideId}&propertyId=${propertyId}`);
  };

  if (overrides.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">No date overrides defined for this property.</p>
        <Button 
          className="mt-4"
          onClick={() => router.push(`/admin/pricing/date-overrides/new?propertyId=${propertyId}`)}
        >
          Add Your First Date Override
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableCaption>Date overrides for this property.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Min. Stay</TableHead>
          <TableHead>Price Type</TableHead>
          <TableHead>Available</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overrides.map((override) => (
          <TableRow key={override.id}>
            <TableCell className="font-medium">{formatDate(override.date)}</TableCell>
            <TableCell>${override.customPrice}</TableCell>
            <TableCell>{override.reason || '-'}</TableCell>
            <TableCell>{override.minimumStay || 1} nights</TableCell>
            <TableCell>
              <Badge variant="outline" className={override.flatRate ? "bg-blue-100" : "bg-green-100"}>
                {override.flatRate ? 'Flat Rate' : 'Multiplier'}
              </Badge>
            </TableCell>
            <TableCell>
              <Switch
                checked={override.available}
                disabled={isUpdating === override.id}
                onCheckedChange={(checked) => handleToggleAvailability(override.id, checked)}
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleEditOverride(override.id)}
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
                      <AlertDialogTitle>Delete Date Override</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this date override? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDeleteOverride(override.id)}
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