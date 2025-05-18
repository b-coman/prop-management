'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { updateDateOverride } from '../../actions';
import { Loader2 } from 'lucide-react';

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

export default function EditDateOverridePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const overrideId = searchParams.get('overrideId');
  const propertyId = searchParams.get('propertyId');
  
  const [override, setOverride] = useState<DateOverride | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Property state
  const [propertyName, setPropertyName] = useState('');

  // Form state
  const [date, setDate] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [reason, setReason] = useState('');
  const [minimumStay, setMinimumStay] = useState('1');
  const [available, setAvailable] = useState(true);
  const [flatRate, setFlatRate] = useState(false);
  
  // Load the override data
  useEffect(() => {
    async function loadOverride() {
      if (!overrideId || !propertyId) {
        setError('Missing override ID or property ID');
        setLoading(false);
        return;
      }
      
      try {
        // Get the override
        const overrideDoc = await getDoc(doc(db, 'dateOverrides', overrideId));
        if (!overrideDoc.exists()) {
          setError('Date override not found');
          setLoading(false);
          return;
        }
        
        const overrideData = { id: overrideDoc.id, ...overrideDoc.data() } as DateOverride;
        setOverride(overrideData);
        
        // Set form state
        setDate(overrideData.date);
        setCustomPrice(overrideData.customPrice.toString());
        setReason(overrideData.reason || '');
        setMinimumStay((overrideData.minimumStay || 1).toString());
        setAvailable(overrideData.available);
        setFlatRate(overrideData.flatRate);
        
        // Get property info
        const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
        if (propertyDoc.exists()) {
          const propertyData = propertyDoc.data();
          setPropertyName(propertyData.name || propertyId);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading date override:', error);
        setError('Failed to load date override');
        setLoading(false);
      }
    }
    
    loadOverride();
  }, [overrideId, propertyId]);

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy');
    } catch (error) {
      return dateStr;
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/admin/pricing')}>
          Back to Pricing Management
        </Button>
      </div>
    );
  }
  
  if (!override) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Date override not found</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/admin/pricing')}>
          Back to Pricing Management
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => router.push(`/admin/pricing?propertyId=${propertyId}`)}
      >
        ← Back to Pricing Management
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>Edit Date Override: {formatDisplayDate(override.date)}</CardTitle>
          <CardDescription>
            Update custom pricing for a specific date
          </CardDescription>
        </CardHeader>
        <form action={updateDateOverride}>
          <CardContent className="space-y-6">
            {/* Hidden fields */}
            <input type="hidden" name="id" value={overrideId || ''} />
            <input type="hidden" name="propertyId" value={propertyId || ''} />
            
            {/* Property Info */}
            <div className="bg-slate-50 p-3 rounded-md mb-4">
              <p className="text-sm text-slate-500">Property: <span className="font-medium text-slate-700">{propertyName}</span></p>
            </div>
            
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            
            {/* Custom Price */}
            <div className="space-y-2">
              <Label htmlFor="customPrice">Custom Price</Label>
              <Input
                id="customPrice"
                name="customPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 150.00"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            
            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="e.g. New Year's Eve, Local Festival, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </div>
            
            <Separator />
            
            {/* Minimum Stay */}
            <div className="space-y-2">
              <Label htmlFor="minimumStay">Minimum Stay (Nights)</Label>
              <Input
                id="minimumStay"
                name="minimumStay"
                type="number"
                min="1"
                step="1"
                value={minimumStay}
                onChange={(e) => setMinimumStay(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            
            {/* Availability Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="available">Availability</Label>
                <p className="text-sm text-slate-500">
                  Is this date available for booking?
                </p>
              </div>
              <Switch
                id="available"
                name="available"
                checked={available}
                onCheckedChange={setAvailable}
                disabled={submitting}
              />
            </div>
            
            {/* Flat Rate Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="flatRate">Flat Rate</Label>
                <p className="text-sm text-slate-500">
                  Use the same price regardless of number of guests
                </p>
              </div>
              <Switch
                id="flatRate"
                name="flatRate"
                checked={flatRate}
                onCheckedChange={setFlatRate}
                disabled={submitting}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/pricing?propertyId=${propertyId}`)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}