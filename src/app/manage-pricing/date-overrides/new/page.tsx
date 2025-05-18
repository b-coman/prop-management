'use client';

import { useState, Suspense } from 'react';
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
// Import Firestore functions
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function NewDateOverrideContent() {
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
    setLoading(true);
    setError(null);
    
    try {
      const overrideData = {
        propertyId: propertyId || 'default',
        date: new Date(date),
        customPrice: customPrice ? parseFloat(customPrice) : null,
        reason,
        minimumStay: parseInt(minimumStay) || 1,
        available,
        flatRate,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      await addDoc(collection(db, 'dateOverrides'), overrideData);
      
      router.push('/manage-pricing');
    } catch (error) {
      console.error('Error creating date override:', error);
      setError('Failed to create date override. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">New Date Override</h1>
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Date Override Details</CardTitle>
            <CardDescription>
              Create a pricing override for a specific date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="available">Availability</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="available"
                    checked={available}
                    onCheckedChange={setAvailable}
                  />
                  <span>{available ? 'Available' : 'Unavailable'}</span>
                </div>
              </div>
              
              {available && (
                <>
                  <Separator />
                  
                  <div className="grid gap-2">
                    <Label htmlFor="customPrice">Custom Price</Label>
                    <Input
                      id="customPrice"
                      type="number"
                      step="0.01"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="Leave empty for default pricing"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="flatRate">Pricing Type</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="flatRate"
                        checked={flatRate}
                        onCheckedChange={setFlatRate}
                      />
                      <span>{flatRate ? 'Flat rate (total price)' : 'Per night price'}</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="minimumStay">Minimum Stay (nights)</Label>
                    <Input
                      id="minimumStay"
                      type="number"
                      min="1"
                      value={minimumStay}
                      onChange={(e) => setMinimumStay(e.target.value)}
                    />
                  </div>
                </>
              )}
              
              <Separator />
              
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason / Notes</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Holiday pricing, Special event..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              disabled={loading || !date}
              className="w-full"
            >
              {loading ? 'Creating...' : 'Create Override'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export default function NewDateOverridePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewDateOverrideContent />
    </Suspense>
  );
}