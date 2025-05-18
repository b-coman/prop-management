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
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

interface ClientDateOverridesTableProps {
  propertyId: string;
}

export default function ClientDateOverridesTable({ propertyId }: ClientDateOverridesTableProps) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Load date overrides on component mount or property change
  useEffect(() => {
    const loadOverrides = async () => {
      if (!propertyId) return;

      setLoading(true);
      setError(null);

      try {
        console.log('Loading date overrides for property:', propertyId);

        // First check if DB is initialized
        if (!db) {
          console.error('Firebase DB is not initialized');
          throw new Error('Firebase DB is not initialized');
        }

        try {
          const overridesCollection = collection(db, 'dateOverrides');
          const q = query(
            overridesCollection,
            where('propertyId', '==', propertyId)
            // Temporarily remove orderBy to troubleshoot
            // orderBy('date')
          );

          console.log('Executing date overrides query...');
          const querySnapshot = await getDocs(q);
          console.log('Query complete, date override documents:', querySnapshot.size);

          const fetchedOverrides: DateOverride[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            fetchedOverrides.push({
              id: doc.id,
              propertyId: data.propertyId,
              date: data.date,
              customPrice: data.customPrice || 0,
              reason: data.reason,
              minimumStay: data.minimumStay,
              available: data.available !== false, // Default to true
              flatRate: data.flatRate || false
            });
          });

          console.log('Processed date overrides:', fetchedOverrides.length);
          setOverrides(fetchedOverrides);
        } catch (firestoreErr) {
          console.error('Firestore query error:', firestoreErr);
          setError('Failed to fetch date overrides from the database');
          setOverrides([]);
        }
      } catch (err) {
        console.error('Error loading date overrides:', err);
        setError('An unexpected error occurred while loading date overrides');

        // Always set overrides to empty array so UI doesn't stay in loading state
        setOverrides([]);
      } finally {
        setLoading(false);
      }
    };

    loadOverrides();
  }, [propertyId]);
  
  // Handle available toggle
  const handleAvailableToggle = async (id: string, currentValue: boolean) => {
    try {
      const overrideRef = doc(db, 'dateOverrides', id);
      await updateDoc(overrideRef, {
        available: !currentValue,
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      setOverrides(prevOverrides => prevOverrides.map(override => 
        override.id === id ? { ...override, available: !currentValue } : override
      ));
    } catch (err) {
      console.error('Error updating date override:', err);
      setError('An unexpected error occurred while updating the date override');
    }
  };
  
  // Handle flat rate toggle
  const handleFlatRateToggle = async (id: string, currentValue: boolean) => {
    try {
      const overrideRef = doc(db, 'dateOverrides', id);
      await updateDoc(overrideRef, {
        flatRate: !currentValue,
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      setOverrides(prevOverrides => prevOverrides.map(override => 
        override.id === id ? { ...override, flatRate: !currentValue } : override
      ));
    } catch (err) {
      console.error('Error updating date override:', err);
      setError('An unexpected error occurred while updating the date override');
    }
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    
    try {
      const overrideRef = doc(db, 'dateOverrides', deleteId);
      await deleteDoc(overrideRef);
      
      // Update local state
      setOverrides(prevOverrides => prevOverrides.filter(override => override.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error('Error deleting date override:', err);
      setError('An unexpected error occurred while deleting the date override');
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
    return <div className="py-6 text-center text-slate-500">Loading date overrides...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  if (overrides.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-slate-500 mb-4">No date overrides defined for this property</p>
        <Button 
          onClick={() => router.push(`/manage-pricing/date-overrides/new?propertyId=${propertyId}`)}
        >
          Create First Date Override
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Custom Price</TableHead>
            <TableHead>Min. Stay</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overrides.map((override) => (
            <TableRow key={override.id}>
              <TableCell className="font-medium">{formatDate(override.date)}</TableCell>
              <TableCell>{override.customPrice}</TableCell>
              <TableCell>{override.minimumStay || 1} night{override.minimumStay !== 1 ? 's' : ''}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Badge className={override.flatRate ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                    {override.flatRate ? 'Flat Rate' : 'Per Person'}
                  </Badge>
                  <Switch
                    checked={override.flatRate}
                    onCheckedChange={() => handleFlatRateToggle(override.id, override.flatRate)}
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Badge className={override.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {override.available ? 'Available' : 'Unavailable'}
                  </Badge>
                  <Switch
                    checked={override.available}
                    onCheckedChange={() => handleAvailableToggle(override.id, override.available)}
                  />
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] truncate" title={override.reason || ''}>
                {override.reason || '-'}
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
                      onClick={() => router.push(`/manage-pricing/date-overrides/edit/${override.id}`)}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => setDeleteId(override.id)}
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
              This will permanently delete this date override. 
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