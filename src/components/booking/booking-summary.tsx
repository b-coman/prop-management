// src/components/booking/booking-summary.tsx
"use client";

import * as React from 'react';
import { useState } from 'react';
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

  const toggleExpansion = () => setIsExpanded(!isExpanded);

  // Convert pricing details to the selected display currency
  const pricingDetailsForDisplay = React.useMemo(() => {
    if (pricingDetails) {
      return {
        basePrice: convertToSelectedCurrency(pricingDetails.basePrice, propertyBaseCcy),
        extraGuestFee: convertToSelectedCurrency(pricingDetails.extraGuestFeeTotal, propertyBaseCcy),
        cleaningFee: convertToSelectedCurrency(pricingDetails.cleaningFee, propertyBaseCcy),
        subtotal: convertToSelectedCurrency(pricingDetails.subtotal, propertyBaseCcy),
        discountAmount: convertToSelectedCurrency(pricingDetails.discountAmount, propertyBaseCcy),
        total: convertToSelectedCurrency(pricingDetails.total, propertyBaseCcy),
        numberOfNights: pricingDetails.numberOfNights, // Keep nights as is
      };
    }
    return null;
  }, [pricingDetails, convertToSelectedCurrency, propertyBaseCcy]);

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
