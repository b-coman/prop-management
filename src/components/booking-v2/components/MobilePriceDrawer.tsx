/**
 * MobilePriceDrawer V2.4 - Currency-Aware Mobile Price Breakdown
 * 
 * @file-status: ACTIVE
 * @v2-role: MOBILE - Mobile-specific price breakdown drawer
 * @created: 2025-06-02
 * @updated: 2025-06-04 (V2.4 - Fixed currency conversion consistency)
 * @description: Airbnb-style bottom drawer for mobile price breakdown.
 *               Slides up from bottom with backdrop and smooth animations.
 *               V2.4 ensures all prices display in user's selected currency.
 * @dependencies: Sheet from shadcn/ui, CurrencyContext
 * @v2.4-changes: Fixed formatPrice calls to use convertToSelectedCurrency, removed misleading currency notice
 */

"use client";

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChevronDown } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLanguage } from '@/lib/language-system';
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
  const { formatPrice, selectedCurrency, convertToSelectedCurrency } = useCurrency();
  const { t } = useLanguage();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 py-1 px-2 -mr-2"
        >
{t('booking.showPriceDetails', 'Show price details')} <ChevronDown className="h-3 w-3" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('booking.priceDetails', 'Price Details')}</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-4">
          {/* Accommodation */}
          <div>
            <h3 className="font-medium mb-2">Accommodation</h3>
            <div className="flex justify-between items-center">
              <span className="text-sm">
                {formatPrice(convertToSelectedCurrency(pricing.accommodationTotal / nights, pricing.currency))} × {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
              <span className="text-sm font-medium">{formatPrice(convertToSelectedCurrency(pricing.accommodationTotal, pricing.currency))}</span>
            </div>
          </div>

          {/* Additional Fees */}
          {(pricing.cleaningFee > 0 || (pricing.taxes && pricing.taxes > 0)) && (
            <div>
              <h3 className="font-medium mb-2">Additional Fees</h3>
              {pricing.cleaningFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cleaning fee</span>
                  <span className="text-sm">{formatPrice(convertToSelectedCurrency(pricing.cleaningFee, pricing.currency))}</span>
                </div>
              )}
              {pricing.taxes && pricing.taxes > 0 && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm">Taxes</span>
                  <span className="text-sm">{formatPrice(convertToSelectedCurrency(pricing.taxes, pricing.currency))}</span>
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
                  <span className="text-sm">-{formatPrice(convertToSelectedCurrency(pricing.lengthOfStayDiscount.discountAmount, pricing.currency))}</span>
                </div>
              )}
              {pricing.couponDiscount && pricing.couponDiscount.discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-600 mt-2">
                  <span className="text-sm">Coupon ({pricing.couponDiscount.discountPercentage}%)</span>
                  <span className="text-sm">-{formatPrice(convertToSelectedCurrency(pricing.couponDiscount.discountAmount, pricing.currency))}</span>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-lg font-semibold">{formatPrice(convertToSelectedCurrency(pricing.totalPrice || pricing.total, pricing.currency))}</span>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}