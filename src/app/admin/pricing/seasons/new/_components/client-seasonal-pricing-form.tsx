'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Alert, 
  AlertTitle, 
  AlertDescription 
} from '@/components/ui/alert';
import { createSeasonalPricing } from '@/app/admin/pricing/actions';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

interface ClientSeasonalPricingFormProps {
  propertyId: string;
  propertyName: string;
  basePrice: number;
  error: string | null;
}

/**
 * Client component for the seasonal pricing form
 * 
 * This is a form for creating new seasonal pricing rules
 */
export function ClientSeasonalPricingForm({
  propertyId,
  propertyName,
  basePrice,
  error: serverError
}: ClientSeasonalPricingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  
  // Calculate price preview based on multiplier
  const [priceMultiplier, setPriceMultiplier] = useState(1);
  const previewPrice = Math.round(basePrice * priceMultiplier);

  // Form submission handler
  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    
    try {
      await createSeasonalPricing(formData);
      setFormSuccess('Season created successfully! Redirecting...');
      
      // Server action will handle the redirect, this is just a fallback
      setTimeout(() => {
        router.push(`/admin/pricing?propertyId=${propertyId}&server=true`);
      }, 1500);
    } catch (err: any) {
      console.error('Error creating season:', err);
      setFormError(err.message || 'Failed to create seasonal pricing');
      setIsSubmitting(false);
    }
  };

  const seasonTypes = [
    { value: 'minimum', label: 'Minimum (30% OFF)', multiplier: 0.7 },
    { value: 'low', label: 'Low (15% OFF)', multiplier: 0.85 },
    { value: 'standard', label: 'Standard (Regular Price)', multiplier: 1.0 },
    { value: 'medium', label: 'Medium (20% EXTRA)', multiplier: 1.2 },
    { value: 'high', label: 'High (50% EXTRA)', multiplier: 1.5 }
  ];

  return (
    <div className="space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      
      {formSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">{formSuccess}</AlertDescription>
        </Alert>
      )}
      
      <form action={handleSubmit} className="space-y-4">
        {/* Hidden property ID field */}
        <input type="hidden" name="propertyId" value={propertyId} />
        
        {/* Property Info */}
        <div className="bg-slate-50 p-3 rounded-md mb-4">
          <p className="text-sm text-slate-500">Property: <span className="font-medium text-slate-700">{propertyName}</span></p>
          <p className="text-sm text-slate-500">Base Price: <span className="font-medium text-slate-700">{basePrice}</span></p>
        </div>
        
        {/* Season Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Season Name</Label>
          <Input 
            id="name" 
            name="name" 
            placeholder="e.g. Summer 2024" 
            required 
            disabled={isSubmitting}
          />
        </div>
        
        {/* Season Type */}
        <div className="space-y-2">
          <Label htmlFor="seasonType">Season Type</Label>
          <Select 
            name="seasonType" 
            required 
            disabled={isSubmitting}
            onValueChange={(value) => {
              const selectedType = seasonTypes.find(type => type.value === value);
              if (selectedType) {
                setPriceMultiplier(selectedType.multiplier);
              }
            }}
            defaultValue="standard"
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
          <Label htmlFor="priceMultiplier">Custom Price Multiplier (optional)</Label>
          <Input 
            id="priceMultiplier" 
            name="priceMultiplier" 
            type="number" 
            step="0.01" 
            min="0.5" 
            max="3"
            placeholder="1.5"
            value={priceMultiplier}
            onChange={(e) => setPriceMultiplier(parseFloat(e.target.value) || 1)}
            disabled={isSubmitting}
          />
          <p className="text-xs text-slate-500">
            Override the default multiplier for the selected season type.
          </p>
        </div>
        
        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input 
              id="startDate" 
              name="startDate" 
              type="date" 
              required 
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input 
              id="endDate" 
              name="endDate" 
              type="date" 
              required 
              disabled={isSubmitting}
            />
          </div>
        </div>
        
        {/* Minimum Stay */}
        <div className="space-y-2">
          <Label htmlFor="minimumStay">Minimum Stay (nights)</Label>
          <Input 
            id="minimumStay" 
            name="minimumStay" 
            type="number" 
            min="1" 
            max="14"
            placeholder="1" 
            defaultValue="1"
            disabled={isSubmitting}
          />
        </div>
        
        {/* Form Buttons */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push(`/admin/pricing?propertyId=${propertyId}&server=true`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Season'}
          </Button>
        </div>
      </form>
    </div>
  );
}