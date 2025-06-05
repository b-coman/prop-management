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
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
import { updateSeasonalPricing } from '../../actions';
import { Loader2 } from 'lucide-react';

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

export default function EditSeasonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seasonId = searchParams.get('seasonId');
  const propertyId = searchParams.get('propertyId');
  
  const [season, setSeason] = useState<SeasonalPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Property state (for price preview)
  const [basePrice, setBasePrice] = useState(100);
  const [propertyName, setPropertyName] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [seasonType, setSeasonType] = useState<'minimum' | 'low' | 'standard' | 'medium' | 'high'>('standard');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState(1);
  const [minimumStay, setMinimumStay] = useState(1);
  const [enabled, setEnabled] = useState(true);
  
  // Load the season data
  useEffect(() => {
    async function loadSeason() {
      if (!seasonId || !propertyId) {
        setError('Missing season ID or property ID');
        setLoading(false);
        return;
      }
      
      try {
        // Get the season
        const seasonDoc = await getDoc(doc(db, 'seasonalPricing', seasonId));
        if (!seasonDoc.exists()) {
          setError('Seasonal pricing rule not found');
          setLoading(false);
          return;
        }
        
        const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as SeasonalPricing;
        setSeason(seasonData);
        
        // Set form state
        setName(seasonData.name);
        setSeasonType(seasonData.seasonType);
        setStartDate(seasonData.startDate);
        setEndDate(seasonData.endDate);
        setPriceMultiplier(seasonData.priceMultiplier);
        setMinimumStay(seasonData.minimumStay || 1);
        setEnabled(seasonData.enabled);
        
        // Get property info for price preview
        const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
        if (propertyDoc.exists()) {
          const propertyData = propertyDoc.data();
          setBasePrice(propertyData.pricePerNight || 100);
          setPropertyName(propertyData.name || propertyId);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading seasonal pricing rule:', error);
        setError('Failed to load seasonal pricing rule');
        setLoading(false);
      }
    }
    
    loadSeason();
  }, [seasonId, propertyId]);

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
  
  const seasonTypes = [
    { value: 'minimum', label: 'Minimum (30% OFF)', multiplier: 0.7 },
    { value: 'low', label: 'Low (15% OFF)', multiplier: 0.85 },
    { value: 'standard', label: 'Standard (Regular Price)', multiplier: 1.0 },
    { value: 'medium', label: 'Medium (20% EXTRA)', multiplier: 1.2 },
    { value: 'high', label: 'High (50% EXTRA)', multiplier: 1.5 }
  ];
  
  // Calculate price preview based on multiplier
  const previewPrice = Math.round(basePrice * priceMultiplier);
  
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
  
  if (!season) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Season not found</AlertDescription>
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
          <CardTitle>Edit Season: {season.name}</CardTitle>
          <CardDescription>
            Update seasonal pricing rule settings
          </CardDescription>
        </CardHeader>
        <form action={updateSeasonalPricing}>
          <CardContent className="space-y-6">
            {/* Hidden fields */}
            <input type="hidden" name="id" value={seasonId || ''} />
            <input type="hidden" name="propertyId" value={propertyId || ''} />
            <input type="hidden" name="enabled" value={enabled.toString()} />
            
            {/* Property Info */}
            <div className="bg-slate-50 p-3 rounded-md mb-4">
              <p className="text-sm text-slate-500">Property: <span className="font-medium text-slate-700">{propertyName}</span></p>
              <p className="text-sm text-slate-500">Base Price: <span className="font-medium text-slate-700">{basePrice}</span></p>
            </div>
            
            {/* Status */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled" className="text-base font-medium">Status</Label>
                <p className="text-sm text-slate-500">Enable or disable this seasonal pricing rule</p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
            
            <Separator />
            
            {/* Season Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Season Name</Label>
              <Input 
                id="name" 
                name="name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer 2024" 
                required 
                disabled={submitting}
              />
            </div>
            
            {/* Season Type */}
            <div className="space-y-2">
              <Label htmlFor="seasonType">Season Type</Label>
              <Select 
                name="seasonType" 
                value={seasonType}
                onValueChange={(value: 'minimum' | 'low' | 'standard' | 'medium' | 'high') => {
                  setSeasonType(value);
                  const selectedType = seasonTypes.find(type => type.value === value);
                  if (selectedType) {
                    setPriceMultiplier(selectedType.multiplier);
                  }
                }}
                required 
                disabled={submitting}
              >
                <SelectTrigger id="seasonType">
                  <SelectValue placeholder="Select season type" />
                </SelectTrigger>
                <SelectContent>
                  {seasonTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-500">
                Price will be: <span className="font-medium">{previewPrice}</span> 
                {priceMultiplier !== 1 && (
                  <span> ({priceMultiplier > 1 ? '+' : ''}{((priceMultiplier - 1) * 100).toFixed(0)}%)</span>
                )}
              </p>
            </div>
            
            {/* Price Multiplier */}
            <div className="space-y-2">
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
                <input type="hidden" name="priceMultiplier" value={priceMultiplier} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>-50%</span>
                <span>Base</span>
                <span>+100%</span>
              </div>
            </div>
            
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input 
                  id="startDate" 
                  name="startDate" 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required 
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input 
                  id="endDate" 
                  name="endDate" 
                  type="date"
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  required 
                  disabled={submitting}
                />
              </div>
            </div>
            
            {/* Minimum Stay */}
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
                <input type="hidden" name="minimumStay" value={minimumStay} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1 night</span>
                <span>7 nights</span>
              </div>
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