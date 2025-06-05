'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { format } from 'date-fns';
import { createDateOverride } from '../../actions';

export default function NewDateOverridePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  
  const [date, setDate] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [reason, setReason] = useState('');
  const [minimumStay, setMinimumStay] = useState('1');
  const [available, setAvailable] = useState(true);
  const [flatRate, setFlatRate] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!propertyId) {
      setError('Property ID is required');
      return;
    }
    
    if (!date) {
      setError('Date is required');
      return;
    }
    
    if (!customPrice) {
      setError('Custom price is required');
      return;
    }
    
    const customPriceValue = parseFloat(customPrice);
    if (isNaN(customPriceValue) || customPriceValue <= 0) {
      setError('Custom price must be a positive number');
      return;
    }
    
    const minimumStayValue = parseInt(minimumStay, 10);
    if (isNaN(minimumStayValue) || minimumStayValue < 1) {
      setError('Minimum stay must be at least 1 night');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await createDateOverride({
        propertyId,
        date,
        customPrice: customPriceValue,
        reason: reason || undefined,
        minimumStay: minimumStayValue,
        available,
        flatRate
      });
      
      if (result.success) {
        router.push('/admin/pricing');
      } else {
        setError(result.error || 'Failed to create date override');
      }
    } catch (err) {
      console.error('Error creating date override:', err);
      setError('An unexpected error occurred while creating the date override');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => router.push('/admin/pricing')}
      >
        ← Back to Pricing Management
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>Add Date Override</CardTitle>
          <CardDescription>
            Set a custom price for a specific date (holiday, special event, etc.)
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="customPrice">Custom Price</Label>
              <Input
                id="customPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 150.00"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g. New Year's Eve, Local Festival, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minimumStay">Minimum Stay (Nights)</Label>
                <Input
                  id="minimumStay"
                  type="number"
                  min="1"
                  step="1"
                  value={minimumStay}
                  onChange={(e) => setMinimumStay(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="available">Availability</Label>
                  <p className="text-sm text-slate-500">
                    Is this date available for booking?
                  </p>
                </div>
                <Switch
                  id="available"
                  checked={available}
                  onCheckedChange={setAvailable}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="flatRate">Flat Rate</Label>
                  <p className="text-sm text-slate-500">
                    Use the same price regardless of number of guests
                  </p>
                </div>
                <Switch
                  id="flatRate"
                  checked={flatRate}
                  onCheckedChange={setFlatRate}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/pricing')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Override'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}