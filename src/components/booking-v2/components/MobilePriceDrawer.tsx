/**
 * MobilePriceDrawer V2.3 - Mobile Bottom Drawer for Price Breakdown
 * 
 * @file-status: ACTIVE
 * @v2-role: MOBILE - Mobile-specific price breakdown drawer
 * @created: 2025-06-02
 * @description: Airbnb-style bottom drawer for mobile price breakdown.
 *               Slides up from bottom with backdrop and smooth animations.
 * @dependencies: Sheet from shadcn/ui
 */

"use client";

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChevronDown } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { Property, PricingResponse } from '@/types';

interface MobilePriceDrawerProps {
  property: Property;
  pricing: PricingResponse;
  checkInDate: Date;
  checkOutDate: Date;
  guestCount: number;
  nights: number;
}

export function MobilePriceDrawer({
  property,
  pricing,
  checkInDate,
  checkOutDate,
  guestCount,
  nights
}: MobilePriceDrawerProps) {
  const { formatPrice, selectedCurrency } = useCurrency();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="w-full text-sm text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-2 py-2"
        >
          Show price details <ChevronDown className="h-3 w-3" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>Price Details</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-4">
          {/* Accommodation */}
          <div>
            <h3 className="font-medium mb-2">Accommodation</h3>
            <div className="flex justify-between items-center">
              <span className="text-sm">
                {formatPrice(pricing.accommodationTotal / nights, pricing.currency)} × {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
              <span className="text-sm font-medium">{formatPrice(pricing.accommodationTotal, pricing.currency)}</span>
            </div>
          </div>

          {/* Additional Fees */}
          {(pricing.cleaningFee > 0 || pricing.taxes > 0) && (
            <div>
              <h3 className="font-medium mb-2">Additional Fees</h3>
              {pricing.cleaningFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cleaning fee</span>
                  <span className="text-sm">{formatPrice(pricing.cleaningFee, pricing.currency)}</span>
                </div>
              )}
              {pricing.taxes > 0 && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm">Taxes</span>
                  <span className="text-sm">{formatPrice(pricing.taxes, pricing.currency)}</span>
                </div>
              )}
            </div>
          )}

          {/* Discounts */}
          {((pricing.lengthOfStayDiscount && pricing.lengthOfStayDiscount.discountAmount > 0) || 
            (pricing.couponDiscount && pricing.couponDiscount.discountAmount > 0)) && (
            <div>
              <h3 className="font-medium mb-2 text-green-600">Discounts</h3>
              {pricing.lengthOfStayDiscount && pricing.lengthOfStayDiscount.discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span className="text-sm">Length of stay ({pricing.lengthOfStayDiscount.discountPercentage}%)</span>
                  <span className="text-sm">-{formatPrice(pricing.lengthOfStayDiscount.discountAmount, pricing.currency)}</span>
                </div>
              )}
              {pricing.couponDiscount && pricing.couponDiscount.discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-600 mt-2">
                  <span className="text-sm">Coupon ({pricing.couponDiscount.discountPercentage}%)</span>
                  <span className="text-sm">-{formatPrice(pricing.couponDiscount.discountAmount, pricing.currency)}</span>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-lg font-semibold">{formatPrice(pricing.totalPrice || pricing.total, pricing.currency)}</span>
            </div>
          </div>

          {/* Currency Notice */}
          {pricing.currency !== selectedCurrency && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Prices shown in {pricing.currency}. Will be converted to {selectedCurrency} at checkout.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}