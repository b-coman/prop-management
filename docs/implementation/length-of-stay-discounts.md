# Length-of-Stay Discounts Implementation Plan

This document outlines the implementation strategy for adding length-of-stay discounts to the RentalSpot-Builder system.

## Overview

Length-of-stay (LOS) discounts are a common pricing strategy in the rental industry, encouraging guests to book longer stays by offering progressive discounts based on the number of nights booked. This feature will allow property owners to automatically apply tiered discounts for longer bookings.

## Goals

1. Allow property managers to configure tiered length-of-stay discounts
2. Automatically apply appropriate discount rates during the booking process
3. Show potential discount opportunities to guests during booking
4. Track discount origins in booking records for analytics

## Data Model Changes

### Property Model Extension

Add LOS discount configuration to the `Property` interface:

```typescript
// Add to src/types/index.ts

interface LengthOfStayDiscount {
  nightsThreshold: number;       // Minimum nights to qualify
  discountPercentage: number;    // Discount percentage (0-100)
  enabled: boolean;              // Whether this tier is active
}

// Extend Property interface
interface Property {
  // Existing fields...
  
  // New field
  lengthOfStayDiscounts?: LengthOfStayDiscount[];
}
```

### Booking Record Extension

Extend the `BookingPricing` interface to track LOS discount information:

```typescript
// Add to src/types/index.ts

interface BookingPricing {
  // Existing fields...
  
  // New fields
  lengthOfStayDiscount?: {
    appliedTier: number;          // Which LOS discount tier was applied
    discountPercentage: number;   // The percentage that was applied
    discountAmount: number;       // The actual discount amount
  };
}
```

## Implementation Steps

### 1. Backend Data Structure Updates

**Tasks**:
- Update Firestore schema for property documents
- Add migration script for existing properties
- Implement data validation for LOS discount tiers

**Sample Default Configuration**:
```json
"lengthOfStayDiscounts": [
  { "nightsThreshold": 7, "discountPercentage": 5, "enabled": true },
  { "nightsThreshold": 14, "discountPercentage": 10, "enabled": true },
  { "nightsThreshold": 28, "discountPercentage": 15, "enabled": true }
]
```

### 2. Price Calculation Logic Updates

**File**: `src/lib/price-utils.ts`

Modify the `calculatePrice` function to consider length-of-stay discounts:

```typescript
export function calculatePrice(
  pricePerNight: number,
  numberOfNights: number,
  cleaningFee: number,
  numberOfGuests: number,
  baseOccupancy: number,
  extraGuestFeePerNight: number,
  baseCurrency: CurrencyCode,
  discountPercentage: number = 0,
  dailyPriceModifiers?: Record<string, number>,
  // New parameter
  lengthOfStayDiscounts?: LengthOfStayDiscount[]
): PriceCalculationResult {
  // Existing calculation logic...
  
  // Calculate base subtotal
  const subtotal = basePrice + extraGuestFeeTotal + cleaningFee;
  
  // Determine applicable LOS discount (if any)
  let losDiscountPercentage = 0;
  let appliedLosDiscount = null;
  
  if (lengthOfStayDiscounts && lengthOfStayDiscounts.length > 0) {
    // Find the highest eligible discount tier
    const applicableTiers = lengthOfStayDiscounts
      .filter(tier => tier.enabled && numberOfNights >= tier.nightsThreshold)
      .sort((a, b) => b.discountPercentage - a.discountPercentage);
    
    if (applicableTiers.length > 0) {
      const highestTier = applicableTiers[0];
      losDiscountPercentage = highestTier.discountPercentage;
      appliedLosDiscount = highestTier;
    }
  }
  
  // Combine with any explicit coupon discount
  const totalDiscountPercentage = Math.min(100, losDiscountPercentage + discountPercentage);
  const discountAmount = subtotal * (totalDiscountPercentage / 100);
  
  // Continue with existing logic...
  const total = subtotal - discountAmount;
  
  return {
    // Existing fields...
    discountAmount: discountAmount,
    total: total,
    // New fields
    losDiscount: appliedLosDiscount ? {
      appliedTier: appliedLosDiscount.nightsThreshold,
      discountPercentage: appliedLosDiscount.discountPercentage,
      discountAmount: subtotal * (appliedLosDiscount.discountPercentage / 100)
    } : undefined
  };
}
```

### 3. Booking Context Integration

**File**: `src/contexts/BookingContext.tsx`

Update the Booking Context to handle LOS discounts:

```typescript
// Add to BookingContext state and API
const [availableLosDiscounts, setAvailableLosDiscounts] = useState<LengthOfStayDiscount[] | null>(null);
const [appliedLosDiscount, setAppliedLosDiscount] = useState<LengthOfStayDiscount | null>(null);

// Add effect to automatically detect applicable LOS discounts when nights change
useEffect(() => {
  if (property?.lengthOfStayDiscounts && numberOfNights > 0) {
    const applicable = property.lengthOfStayDiscounts
      .filter(tier => tier.enabled && numberOfNights >= tier.nightsThreshold)
      .sort((a, b) => b.nightsThreshold - a.nightsThreshold);
    
    setAvailableLosDiscounts(applicable.length > 0 ? applicable : null);
    
    // Auto-apply the highest applicable discount
    if (applicable.length > 0) {
      setAppliedLosDiscount(applicable[0]);
    } else {
      setAppliedLosDiscount(null);
    }
  }
}, [property, numberOfNights]);
```

### 4. Price Calculation Hook Updates

**File**: `src/components/booking/hooks/usePriceCalculation.ts`

Update `usePriceCalculation` to integrate LOS discounts:

```typescript
// Inside usePriceCalculation hook
const { 
  numberOfGuests, 
  numberOfNights,
  appliedCouponCode,
  appliedLosDiscount, // Access from BookingContext
} = useBooking();

// Calculate pricing details based on current state
const pricingDetails = useMemo(() => {
  // Only calculate if we have valid data
  if (actualNights > 0 && numberOfGuests > 0) {
    return calculatePrice(
      property.pricePerNight,
      actualNights,
      property.cleaningFee ?? 0,
      numberOfGuests,
      property.baseOccupancy,
      property.extraGuestFee ?? 0,
      propertyBaseCcy,
      appliedCoupon?.discountPercentage,
      dailyPriceModifiers,
      property.lengthOfStayDiscounts // Pass LOS discount configuration
    );
  }
  
  return null;
}, [
  // Existing dependencies...
  appliedLosDiscount,
  property.lengthOfStayDiscounts
]);
```

### 5. Booking Summary UI Updates

**File**: `src/components/booking/sections/common/BookingSummary.tsx`

Update the Booking Summary to display LOS discounts:

```tsx
// Inside BookingSummary component
const losDiscount = pricingDetails?.losDiscount;

// In the render function, add LOS discount display
{losDiscount && (
  <div className="flex justify-between text-green-600">
    <span>Length of stay discount ({losDiscount.appliedTier}+ nights)</span>
    <span>-${losDiscount.discountAmount}</span>
  </div>
)}

// Update total calculation to include both coupon and LOS discounts
const actualTotal = pricingDetails ? pricingDetails.total : 0;
```

### 6. Property Admin UI Updates

Add UI for configuring LOS discounts in the property admin section:

**File**: Create `src/components/admin/properties/LengthOfStayDiscountEditor.tsx`

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { LengthOfStayDiscount } from '@/types';

interface LengthOfStayDiscountEditorProps {
  initialDiscounts: LengthOfStayDiscount[];
  onSave: (discounts: LengthOfStayDiscount[]) => void;
}

export function LengthOfStayDiscountEditor({ 
  initialDiscounts, 
  onSave 
}: LengthOfStayDiscountEditorProps) {
  const [discounts, setDiscounts] = useState<LengthOfStayDiscount[]>(
    initialDiscounts.length > 0 ? initialDiscounts : [
      { nightsThreshold: 7, discountPercentage: 5, enabled: false },
      { nightsThreshold: 14, discountPercentage: 10, enabled: false },
      { nightsThreshold: 28, discountPercentage: 15, enabled: false }
    ]
  );

  const addDiscountTier = () => {
    setDiscounts([...discounts, { nightsThreshold: 1, discountPercentage: 0, enabled: true }]);
  };

  const updateDiscount = (index: number, field: keyof LengthOfStayDiscount, value: any) => {
    const updatedDiscounts = [...discounts];
    updatedDiscounts[index] = { ...updatedDiscounts[index], [field]: value };
    setDiscounts(updatedDiscounts);
  };

  const removeDiscount = (index: number) => {
    setDiscounts(discounts.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Sort by threshold before saving
    const sortedDiscounts = [...discounts].sort(
      (a, b) => a.nightsThreshold - b.nightsThreshold
    );
    onSave(sortedDiscounts);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Length of Stay Discounts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {discounts.map((discount, index) => (
            <div key={index} className="flex items-center space-x-4 border p-3 rounded-md">
              <Switch 
                checked={discount.enabled} 
                onCheckedChange={checked => updateDiscount(index, 'enabled', checked)} 
              />
              <div className="flex items-center">
                <span className="mr-2">Stay</span>
                <Input 
                  type="number" 
                  min={1} 
                  className="w-16" 
                  value={discount.nightsThreshold} 
                  onChange={e => updateDiscount(index, 'nightsThreshold', parseInt(e.target.value))} 
                />
                <span className="mx-2">nights or more: Discount</span>
                <Input 
                  type="number" 
                  min={0} 
                  max={100} 
                  className="w-16" 
                  value={discount.discountPercentage} 
                  onChange={e => updateDiscount(index, 'discountPercentage', parseInt(e.target.value))} 
                />
                <span className="ml-2">%</span>
              </div>
              <Button variant="destructive" size="sm" onClick={() => removeDiscount(index)}>
                Remove
              </Button>
            </div>
          ))}
          
          <Button variant="outline" onClick={addDiscountTier}>
            Add Discount Tier
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave}>Save Discounts</Button>
      </CardFooter>
    </Card>
  );
}
```

Integrate this component into the property edit page:

```tsx
// In src/app/admin/properties/[slug]/edit/page.tsx
// Add to the property form

<Tabs defaultValue="general">
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="location">Location</TabsTrigger>
    <TabsTrigger value="pricing">Pricing</TabsTrigger>
    {/* Other tabs */}
  </TabsList>
  
  {/* Pricing tab content */}
  <TabsContent value="pricing">
    {/* Base pricing fields */}
    
    {/* Length of stay discounts */}
    <LengthOfStayDiscountEditor 
      initialDiscounts={property.lengthOfStayDiscounts || []}
      onSave={handleSaveLosDiscounts}
    />
  </TabsContent>
</Tabs>
```

### 7. Booking Flow Enhancements

Add UI elements to promote discounts for longer stays:

**File**: `src/components/booking/sections/availability/DateAlternatives.tsx`

```tsx
// Inside DateAlternatives component
// Add this after the selected dates section

const { property, numberOfNights } = useBooking();

// Show potential discounts for longer stays
const losDiscounts = property?.lengthOfStayDiscounts?.filter(d => d.enabled) || [];
const nextDiscount = losDiscounts.find(d => d.nightsThreshold > numberOfNights);

{nextDiscount && (
  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
    <div className="flex items-center text-green-600">
      <IconTag className="mr-2 h-4 w-4" />
      <span className="font-medium">Save {nextDiscount.discountPercentage}% by staying longer!</span>
    </div>
    <p className="text-sm text-green-700 mt-1">
      Book {nextDiscount.nightsThreshold} nights or more to receive an automatic {nextDiscount.discountPercentage}% discount.
    </p>
    <Button variant="outline" size="sm" className="mt-2 border-green-500 text-green-600 hover:bg-green-50">
      Extend to {nextDiscount.nightsThreshold} nights
    </Button>
  </div>
)}
```

### 8. Booking Service Updates

**File**: `src/services/bookingService.ts`

Update the booking creation to handle LOS discounts:

```typescript
// Inside createBooking function
// When constructing booking pricing data

const pricingResult = calculatePrice(
  property.pricePerNight,
  nights,
  property.cleaningFee ?? 0,
  bookingData.numberOfGuests,
  property.baseOccupancy,
  property.extraGuestFee ?? 0,
  property.baseCurrency,
  appliedCoupon?.discountPercentage ?? 0,
  dailyPriceModifiers,
  property.lengthOfStayDiscounts
);

// Store LOS discount details in the booking record
const bookingPricing: BookingPricing = {
  // Existing fields...
  
  // Add LOS discount information if applicable
  lengthOfStayDiscount: pricingResult.losDiscount,
};
```

## Testing Strategy

1. **Unit Tests**:
   - Test discount tier selection logic
   - Test calculation with multiple tiers
   - Test discount amount computations
   - Test combined discounts (LOS + coupons)

2. **Integration Tests**:
   - Test complete booking flow with LOS discounts
   - Verify discount reflection in Stripe payments
   - Test discount display in booking summary

3. **Manual Testing Scenarios**:
   - Configure different discount tiers
   - Book stays of varying lengths
   - Verify discount application accuracy
   - Test admin UI for LOS discount management

## User Experience Improvements

1. **Promotional Elements**:
   - Add "Stay longer and save" messaging near date selection
   - Show potential discounts for slightly longer stays
   - Add discount badges to calendar display

2. **Transparency**:
   - Clear breakdown of applied discounts
   - Show which discount tier was applied
   - Provide savings amount in both percentage and currency

## Implementation Phases

### Phase 1: Core Functionality
- Data model updates
- Basic calculation integration
- Display in booking summary

### Phase 2: Admin UI
- Discount tier configuration UI
- Testing tools for property managers

### Phase 3: User Experience Enhancements
- Promotional elements
- Proactive discount suggestions
- Analytics for discount effectiveness

## Estimated Timeline

- Backend implementation: 2 days
- Admin UI development: 2 days
- Frontend integration: 1 day
- Testing and refinement: 1 day
- Total: 6 days