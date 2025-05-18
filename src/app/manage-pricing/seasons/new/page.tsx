'use client';

import { useState, useEffect, Suspense } from 'react';
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
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { SeasonType, SEASON_MULTIPLIERS } from '@/lib/pricing/price-calculation';
// Import Firestore functions
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function NewSeasonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  
  const [name, setName] = useState('');
  const [seasonType, setSeasonType] = useState<SeasonType>('standard');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);
  const [minimumStay, setMinimumStay] = useState('1');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Update price multiplier when season type changes
  useEffect(() => {
    if (seasonType) {
      setPriceMultiplier(SEASON_MULTIPLIERS[seasonType]);
    }
  }, [seasonType]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (endDateObj <= startDateObj) {
        throw new Error('End date must be after start date');
      }
      
      const seasonData = {
        propertyId: propertyId || 'default',
        name,
        seasonType,
        startDate: Timestamp.fromDate(startDateObj),
        endDate: Timestamp.fromDate(endDateObj),
        priceMultiplier,
        minimumStay: parseInt(minimumStay) || 1,
        active: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      await addDoc(collection(db, 'seasonalPricing'), seasonData);
      
      router.push('/manage-pricing');
    } catch (error) {
      console.error('Error creating season:', error);
      setError(error instanceof Error ? error.message : 'Failed to create season. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container max-w-2xl py-6 lg:py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">New Season</h1>
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
            <CardTitle>Season Details</CardTitle>
            <CardDescription>
              Create a new seasonal pricing rule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Season Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Summer High Season"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="seasonType">Season Type</Label>
                <Select
                  value={seasonType}
                  onValueChange={(value) => setSeasonType(value as SeasonType)}
                >
                  <SelectTrigger id="seasonType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off-season">Off Season (75%)</SelectItem>
                    <SelectItem value="standard">Standard (100%)</SelectItem>
                    <SelectItem value="high-season">High Season (125%)</SelectItem>
                    <SelectItem value="peak-season">Peak Season (150%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="grid gap-2">
                <Label htmlFor="priceMultiplier">
                  Price Multiplier: {(priceMultiplier * 100).toFixed(0)}%
                </Label>
                <Slider
                  id="priceMultiplier"
                  value={[priceMultiplier]}
                  onValueChange={(values) => setPriceMultiplier(values[0])}
                  min={0.5}
                  max={2}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Adjust how much prices are multiplied during this season
                </p>
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
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              disabled={loading || !name || !startDate || !endDate}
              className="w-full"
            >
              {loading ? 'Creating...' : 'Create Season'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export default function NewSeasonPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewSeasonContent />
    </Suspense>
  );
}