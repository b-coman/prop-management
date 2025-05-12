"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface BookingSummaryProps {
  numberOfNights: number;
  numberOfGuests: number;
  pricingDetails: any | null;
  propertyBaseCcy: string;
  appliedCoupon: { code: string; discountPercentage: number } | null;
}

/**
 * BookingSummary component for displaying booking details and pricing
 * 
 * This is a placeholder component that would be implemented with actual logic
 * in a real application.
 */
export function BookingSummary({
  numberOfNights,
  numberOfGuests,
  pricingDetails,
  propertyBaseCcy,
  appliedCoupon,
}: BookingSummaryProps) {
  // Force re-render on prop changes
  const [renderCount, setRenderCount] = React.useState(0);

  // Add identification log to track which component is being used
  React.useEffect(() => {
    console.log(`[IDENTIFICATION] This is BookingSummary from /sections/common/BookingSummary.tsx`);
    console.log(`[BookingSummary/sections] Props updated: numberOfNights=${numberOfNights}, numberOfGuests=${numberOfGuests}, renderCount=${renderCount}`);

    // Force a re-render when props change
    setRenderCount(prev => prev + 1);
  }, [numberOfNights, numberOfGuests, pricingDetails]);

  // Direct access to pricing details for debugging
  React.useEffect(() => {
    if (pricingDetails) {
      console.log(`[BookingSummary/sections] 💰 Pricing details:`, {
        basePrice: pricingDetails.basePrice,
        totalPrice: pricingDetails.total,
        extraGuestFee: pricingDetails.extraGuestFeeTotal,
        numberOfGuests,
        timestamp: new Date().toISOString()
      });
    }
  }, [pricingDetails, numberOfGuests]);

  if (!pricingDetails) {
    return <div className="text-muted-foreground">Calculating price...</div>;
  }
  
  // Force the use of actual data instead of hard-coded values
  const actualBasePrice = pricingDetails ? pricingDetails.basePrice : 0;
  const actualCleaningFee = pricingDetails ? pricingDetails.cleaningFee : 0;
  const actualSubtotal = pricingDetails ? pricingDetails.subtotal : 0;
  const actualDiscount = pricingDetails && appliedCoupon ? pricingDetails.discountAmount : 0;
  const actualTotal = pricingDetails ? pricingDetails.total : 0;

  // Log the values being rendered for debugging
  console.log(`[BookingSummary/sections] 🔢 Rendering with:`, {
    numberOfGuests,
    numberOfNights,
    basePrice: actualBasePrice,
    cleaningFee: actualCleaningFee,
    subtotal: actualSubtotal,
    total: actualTotal,
    renderCount
  });

  return (
    <Card className="bg-muted/50 border border-border/50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-foreground">
            Booking Summary: {numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'}, {numberOfGuests} {numberOfGuests === 1 ? 'guest' : 'guests'}, Total: <span className="font-bold">${actualTotal}</span>
          </p>
        </div>

        <div className="mt-4 space-y-2 text-sm border-t pt-4">
          <div className="flex justify-between">
            <span>Base price ({numberOfNights} nights)</span>
            <span>${actualBasePrice}</span>
          </div>

          {pricingDetails && pricingDetails.extraGuestFeeTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Extra guest fee</span>
              <span>+${pricingDetails.extraGuestFeeTotal}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Cleaning fee</span>
            <span>+${actualCleaningFee}</span>
          </div>

          <Separator className="my-1" />

          <div className="flex justify-between font-medium">
            <span>Subtotal</span>
            <span>${actualSubtotal}</span>
          </div>

          {appliedCoupon && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({appliedCoupon.code})</span>
              <span>-${actualDiscount}</span>
            </div>
          )}

          <Separator className="my-2 font-bold" />

          <div className="flex justify-between font-bold text-base">
            <span>Total ({propertyBaseCcy})</span>
            <span>${actualTotal}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}