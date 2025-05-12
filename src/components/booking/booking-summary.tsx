// src/components/booking/booking-summary.tsx
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { PriceCalculationResult, CurrencyCode } from '@/types';

interface BookingSummaryProps {
  numberOfNights: number;
  numberOfGuests: number;
  pricingDetails: PriceCalculationResult | null;
  propertyBaseCcy: CurrencyCode;
  appliedCoupon: { code: string; discountPercentage: number } | null;
}

export function BookingSummary({
  numberOfNights,
  numberOfGuests,
  pricingDetails,
  propertyBaseCcy,
  appliedCoupon,
}: BookingSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { selectedCurrency, convertToSelectedCurrency, formatPrice } = useCurrency();
  
  // Add identification log
  useEffect(() => {
    console.log(`[IDENTIFICATION] This is BookingSummary from /booking-summary.tsx`);
    console.log(`[BookingSummary] Props updated: numberOfNights=${numberOfNights}, numberOfGuests=${numberOfGuests}`);
    console.log(`[BookingSummary] PricingDetails:`, pricingDetails ? {
      basePrice: pricingDetails.basePrice,
      total: pricingDetails.total,
      currency: pricingDetails.currency
    } : 'null');
  }, [numberOfNights, numberOfGuests, pricingDetails]);

  const toggleExpansion = () => setIsExpanded((prev) => !prev);

  // Convert pricing details to the selected display currency
  const pricingDetailsForDisplay = React.useMemo(() => {
    // Log with a prominent marker to ensure we see it in the console
    console.log(`[!!!RECALCULATION!!!] BookingSummary recalculating pricing details`, {
      nights: numberOfNights,
      guests: numberOfGuests,
      selectedCurrency,
      timestamp: new Date().toISOString(),
      hasPricingDetails: !!pricingDetails,
    });
    
    if (!pricingDetails) {
      console.log(`[BookingSummary] No pricing details available, returning null`);
      return null;
    }
    
    const result = {
      basePrice: convertToSelectedCurrency(pricingDetails.basePrice, propertyBaseCcy),
      extraGuestFee: convertToSelectedCurrency(pricingDetails.extraGuestFeeTotal, propertyBaseCcy),
      cleaningFee: convertToSelectedCurrency(pricingDetails.cleaningFee, propertyBaseCcy),
      subtotal: convertToSelectedCurrency(pricingDetails.subtotal, propertyBaseCcy),
      discountAmount: convertToSelectedCurrency(pricingDetails.discountAmount, propertyBaseCcy),
      total: convertToSelectedCurrency(pricingDetails.total, propertyBaseCcy),
      numberOfNights: pricingDetails.numberOfNights,
      numberOfGuests: numberOfGuests, // Store guest count directly
    };
    
    console.log(`[BookingSummary] Calculated display pricing:`, result);
    return result;
  }, [
    // Including ALL dependencies explicitly to ensure recalculation
    pricingDetails, 
    convertToSelectedCurrency, 
    propertyBaseCcy, 
    numberOfNights, 
    numberOfGuests, 
    selectedCurrency
  ]);

  if (!pricingDetailsForDisplay) {
    return <div className="text-muted-foreground">Calculating price...</div>;
  }

  const formattedTotal = formatPrice(pricingDetailsForDisplay.total, selectedCurrency);

  return (
    <Card className="bg-muted/50 border border-border/50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-foreground">
            Booking Summary: {numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'}, {numberOfGuests} {numberOfGuests === 1 ? 'guest' : 'guests'}, Total: <span className="font-bold">{formattedTotal}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={toggleExpansion} className="text-muted-foreground hover:text-foreground">
            {isExpanded ? 'Hide Details' : 'View Details'}
            {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-4 space-y-2 text-sm border-t pt-4">
            <div className="flex justify-between">
              <span>Base price ({pricingDetailsForDisplay.numberOfNights} nights)</span>
              <span>{formatPrice(pricingDetailsForDisplay.basePrice, selectedCurrency)}</span>
            </div>
            {pricingDetailsForDisplay.extraGuestFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Extra guest fee</span>
                <span>+{formatPrice(pricingDetailsForDisplay.extraGuestFee, selectedCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Cleaning fee</span>
              <span>+{formatPrice(pricingDetailsForDisplay.cleaningFee, selectedCurrency)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>Subtotal</span>
              <span>{formatPrice(pricingDetailsForDisplay.subtotal, selectedCurrency)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({appliedCoupon.code})</span>
                <span>-{formatPrice(pricingDetailsForDisplay.discountAmount, selectedCurrency)}</span>
              </div>
            )}
             <Separator className="my-2 font-bold" />
             <div className="flex justify-between font-bold text-base">
                 <span>Total ({selectedCurrency})</span>
                 <span>{formattedTotal}</span>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
