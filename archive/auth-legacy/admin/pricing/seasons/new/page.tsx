'use client';

import { useState, useEffect } from 'react';
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
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { SeasonType, SEASON_MULTIPLIERS } from '@/lib/pricing/price-calculation';
import { createSeasonalPricing } from '../../actions';

export default function NewSeasonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  
  const [name, setName] = useState('');
  const [seasonType, setSeasonType] = useState<SeasonType>('standard');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState(1);
  const [minimumStay, setMinimumStay] = useState(1);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Set default price multiplier when season type changes
  useEffect(() => {
    setPriceMultiplier(SEASON_MULTIPLIERS[seasonType]);
  }, [seasonType]);
  
  // Format multiplier for display
  const formatMultiplier = (value: number) => {
    const percent = (value - 1) * 100;
    if (percent > 0) {
      return `+${percent.toFixed(0)}%`;
    } else if (percent < 0) {
      return `${percent.toFixed(0)}%`;
    } else {
      return '0%';
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!propertyId) {
      setError('Property ID is required');
      return;
    }
    
    if (!name) {
      setError('Season name is required');
      return;
    }
    
    if (!startDate) {
      setError('Start date is required');
      return;
    }
    
    if (!endDate) {
      setError('End date is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await createSeasonalPricing({
        propertyId,
        name,
        seasonType,
        startDate,
        endDate,
        priceMultiplier,
        minimumStay,
        enabled: true
      });
      
      if (result.success) {
        router.push('/admin/pricing');
      } else {
        setError(result.error || 'Failed to create seasonal pricing rule');
      }
    } catch (err) {
      console.error('Error creating seasonal pricing:', err);
      setError('An unexpected error occurred while creating the seasonal pricing rule');
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
          <CardTitle>Add New Season</CardTitle>
          <CardDescription>
            Create a new seasonal pricing rule for specific dates
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
              <Label htmlFor="name">Season Name</Label>
              <Input
                id="name"
                placeholder="e.g. Summer High Season"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="seasonType">Season Type</Label>
              <Select
                value={seasonType}
                onValueChange={(value: SeasonType) => setSeasonType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a season type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimum">Minimum (Super Low Season)</SelectItem>
                  <SelectItem value="low">Low Season</SelectItem>
                  <SelectItem value="standard">Standard Season</SelectItem>
                  <SelectItem value="medium">Medium Season</SelectItem>
                  <SelectItem value="high">High Season</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
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
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="priceMultiplier">
                  Price Adjustment: {formatMultiplier(priceMultiplier)}
                </Label>
                <div className="pt-2 px-1">
                  <Slider
                    id="priceMultiplier"
                    value={[priceMultiplier]}
                    min={0.5}
                    max={2}
                    step={0.05}
                    onValueChange={(values) => setPriceMultiplier(values[0])}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>-50%</span>
                  <span>Base</span>
                  <span>+100%</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="minimumStay">
                  Minimum Stay: {minimumStay} night{minimumStay !== 1 ? 's' : ''}
                </Label>
                <div className="pt-2 px-1">
                  <Slider
                    id="minimumStay"
                    value={[minimumStay]}
                    min={1}
                    max={7}
                    step={1}
                    onValueChange={(values) => setMinimumStay(values[0])}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1 night</span>
                  <span>7 nights</span>
                </div>
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
              {loading ? 'Creating...' : 'Create Season'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}