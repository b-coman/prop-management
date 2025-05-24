// src/components/booking/booking-summary.tsx
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useBooking } from '@/contexts/BookingContext';
import type { PriceCalculationResult, CurrencyCode } from '@/types';

// Updated interface to optionally support the new dynamic pricing model
interface BookingSummaryProps {
  numberOfNights: number;
  numberOfGuests: number;
  pricingDetails: PriceCalculationResult | null;
  propertyBaseCcy: CurrencyCode;
  appliedCoupon: { code: string; discountPercentage: number } | null;
  // New optional dynamic pricing props
  dynamicPricing?: {
    accommodationTotal: number;
    cleaningFee: number;
    subtotal: number;
    total: number;
    currency: CurrencyCode;
    dailyRates?: Record<string, number>;
    lengthOfStayDiscount?: {
      discountPercentage: number;
      discountAmount: number;
    } | null;
    couponDiscount?: {
      discountPercentage: number;
      discountAmount: number;
    } | null;
  } | null;
}

export const BookingSummary = React.memo(function BookingSummary({
  numberOfNights,
  numberOfGuests,
  pricingDetails,
  propertyBaseCcy,
  appliedCoupon,
  dynamicPricing = null,
  isLoadingPricing = false, // Add loading state parameter
}: BookingSummaryProps & { isLoadingPricing?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { selectedCurrency, convertToSelectedCurrency, formatPrice } = useCurrency();
  
  // CRITICAL FIX Bug #1: Use BookingContext values for display instead of props
  const { numberOfNights: contextNights, numberOfGuests: contextGuests } = useBooking();

  // Add identification log
  useEffect(() => {
    // Log component identification
    console.log(`[IDENTIFICATION] This is BookingSummary from /src/components/booking/booking-summary.tsx`);
    console.log(`[BookingSummary] Props updated: numberOfNights=${numberOfNights}, numberOfGuests=${numberOfGuests}, renderCount=${Math.random().toString(36).substring(7)}`);
    
    // Log pricing model and details
    if (dynamicPricing) {
      console.log(`[BookingSummary] 💰 Dynamic pricing details:`, {
        basePrice: dynamicPricing.accommodationTotal,
        totalPrice: dynamicPricing.total,
        extraGuestFee: dynamicPricing.couponDiscount?.discountAmount,
        numberOfGuests: numberOfGuests,
        timestamp: new Date().toISOString()
      });
    } else if (pricingDetails) {
      console.log(`[BookingSummary] 💰 Standard pricing details:`, {
        basePrice: pricingDetails.basePrice,
        totalPrice: pricingDetails.total,
        extraGuestFee: pricingDetails.extraGuestFeeTotal,
        numberOfGuests: numberOfGuests,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`[BookingSummary] ⚠️ No pricing details available`);
    }
  }, [numberOfNights, numberOfGuests, pricingDetails, dynamicPricing]);

  const toggleExpansion = () => setIsExpanded((prev) => !prev);

  // Convert pricing details to the selected display currency
  const pricingDetailsForDisplay = React.useMemo(() => {
    // If dynamic pricing is provided, use it
    if (dynamicPricing) {
      console.log(`[BookingSummary/details] 🔢 Rendering with dynamicPricing:`, dynamicPricing);
      console.log(`[BookingSummary/details] 🧮 Critical values: total=${dynamicPricing.total}, subtotal=${dynamicPricing.subtotal}`);
      
      const baseCurrency = dynamicPricing.currency || propertyBaseCcy;

      // Process daily rates for display
      const dailyRatesForDisplay = dynamicPricing.dailyRates
        ? Object.entries(dynamicPricing.dailyRates).reduce((acc, [date, price]) => {
            acc[date] = convertToSelectedCurrency(price, baseCurrency);
            return acc;
          }, {} as Record<string, number>)
        : {};

      // Calculate total price, ensuring it's a valid number
      // CRITICAL FIX: Check for NaN or null values and provide safe fallbacks
      // Also support both naming conventions (total and totalPrice) for backward compatibility
      
      // Try totalPrice first (new standard), then fall back to total (old), then subtotal
      const rawTotal = dynamicPricing.totalPrice !== undefined ? dynamicPricing.totalPrice : dynamicPricing.total;
      
      console.log(`[BookingSummary/details] 🧮 NAME CHECK: totalPrice=${dynamicPricing.totalPrice}, total=${dynamicPricing.total}`);
      
      const safeTotal = isNaN(rawTotal) || rawTotal === null || rawTotal === undefined 
          ? dynamicPricing.subtotal // Fall back to subtotal if total is invalid
          : rawTotal;
          
      console.log(`[BookingSummary/details] 🔢 Total price calculation: rawTotal=${rawTotal}, safeTotal=${safeTotal}`);

      return {
        useDynamicModel: true,
        accommodationTotal: convertToSelectedCurrency(dynamicPricing.accommodationTotal || 0, baseCurrency),
        cleaningFee: convertToSelectedCurrency(dynamicPricing.cleaningFee || 0, baseCurrency),
        subtotal: convertToSelectedCurrency(dynamicPricing.subtotal || 0, baseCurrency),
        lengthOfStayDiscount: dynamicPricing.lengthOfStayDiscount
          ? {
              discountPercentage: dynamicPricing.lengthOfStayDiscount.discountPercentage,
              discountAmount: convertToSelectedCurrency(dynamicPricing.lengthOfStayDiscount.discountAmount || 0, baseCurrency)
            }
          : null,
        couponDiscount: dynamicPricing.couponDiscount
          ? {
              discountPercentage: dynamicPricing.couponDiscount.discountPercentage,
              discountAmount: convertToSelectedCurrency(dynamicPricing.couponDiscount.discountAmount || 0, baseCurrency)
            }
          : null,
        totalDiscountAmount: convertToSelectedCurrency(
          (dynamicPricing.lengthOfStayDiscount?.discountAmount || 0) +
          (dynamicPricing.couponDiscount?.discountAmount || 0),
          baseCurrency
        ),
        // Use the safe total to prevent NaN issues
        total: convertToSelectedCurrency(safeTotal, baseCurrency),
        numberOfNights: numberOfNights,
        numberOfGuests: numberOfGuests,
        dailyRates: dailyRatesForDisplay
      };
    }

    // Otherwise use the traditional pricing model
    if (!pricingDetails) {
      return null;
    }

    return {
      useDynamicModel: false,
      basePrice: convertToSelectedCurrency(pricingDetails.basePrice, propertyBaseCcy),
      extraGuestFee: convertToSelectedCurrency(pricingDetails.extraGuestFeeTotal, propertyBaseCcy),
      cleaningFee: convertToSelectedCurrency(pricingDetails.cleaningFee, propertyBaseCcy),
      subtotal: convertToSelectedCurrency(pricingDetails.subtotal, propertyBaseCcy),
      discountAmount: convertToSelectedCurrency(pricingDetails.discountAmount, propertyBaseCcy),
      total: convertToSelectedCurrency(pricingDetails.total, propertyBaseCcy),
      numberOfNights: pricingDetails.numberOfNights,
      numberOfGuests: numberOfGuests
    };
  }, [
    pricingDetails,
    dynamicPricing,
    convertToSelectedCurrency,
    propertyBaseCcy,
    numberOfNights,
    numberOfGuests,
    selectedCurrency
  ]);

  // Check for loading state first
  if (isLoadingPricing) {
    return (
      <Card className="bg-muted/50 border border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-center space-x-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading pricing data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Then check if we have pricing details
  if (!pricingDetailsForDisplay) {
    return (
      <Card className="bg-muted/50 border border-border/50">
        <CardContent className="p-4">
          <div className="text-muted-foreground text-center py-2">Calculating price...</div>
        </CardContent>
      </Card>
    );
  }

  const formattedTotal = formatPrice(pricingDetailsForDisplay.total, selectedCurrency);

  return (
    <Card className="bg-muted/50 border border-border/50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-foreground">
            Booking Summary: {contextNights} {contextNights === 1 ? 'night' : 'nights'}, {contextGuests} {contextGuests === 1 ? 'guest' : 'guests'}, Total: <span className="font-bold">{formattedTotal}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={toggleExpansion} className="text-muted-foreground hover:text-foreground">
            {isExpanded ? 'Hide Details' : 'View Details'}
            {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-4 space-y-2 text-sm border-t pt-4">
            {/* Dynamic pricing model */}
            {pricingDetailsForDisplay.useDynamicModel ? (
              <>
                <div className="flex justify-between">
                  <span>Accommodation ({pricingDetailsForDisplay.numberOfNights} nights)</span>
                  <span>{formatPrice(pricingDetailsForDisplay.accommodationTotal, selectedCurrency)}</span>
                </div>

                {Object.keys(pricingDetailsForDisplay.dailyRates || {}).length > 0 && (
                  <div className="pl-4 space-y-1 text-xs text-muted-foreground">
                    {Object.entries(pricingDetailsForDisplay.dailyRates || {})
                      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                      .map(([date, price]) => (
                        <div key={date} className="flex justify-between">
                          <span className="flex items-center">
                            <CalendarIcon className="h-3 w-3 mr-1" /> {date}
                          </span>
                          <span>{formatPrice(price, selectedCurrency)}</span>
                        </div>
                      ))
                    }
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

                {pricingDetailsForDisplay.lengthOfStayDiscount && (
                  <div className="flex justify-between text-green-600">
                    <span>Stay discount ({pricingDetailsForDisplay.lengthOfStayDiscount.discountPercentage}%)</span>
                    <span>-{formatPrice(pricingDetailsForDisplay.lengthOfStayDiscount.discountAmount, selectedCurrency)}</span>
                  </div>
                )}

                {pricingDetailsForDisplay.couponDiscount && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon discount ({pricingDetailsForDisplay.couponDiscount.discountPercentage}%)</span>
                    <span>-{formatPrice(pricingDetailsForDisplay.couponDiscount.discountAmount, selectedCurrency)}</span>
                  </div>
                )}
              </>
            ) : (
              /* Standard pricing model */
              <>
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
              </>
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
});
