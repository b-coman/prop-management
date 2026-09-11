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
          // nowrap + no-shrink: this shares a row with the total, and when the label was allowed to
          // wrap it silently added 17px to the height of the sticky bar on every phone. Shortened
          // twice for width: first from "Arată detaliile prețului", then to bare "Detalii" so that
          // "toate taxele incluse" beside it could survive a four-figure total at 360px. Sitting
          // against the price, "Detalii" can only mean one thing.
          // 44px of TOUCH on a 28px box. Measured on a 393px phone: the visible label is 28px tall,
          // which is the smallest tap target on the page and it opens the only price breakdown a
          // phone can reach. It cannot simply grow — it shares a row with the total, so height here
          // is height on the sticky bar. So the hit area is a pseudo-element instead: 44px centred
          // on the label, out of flow, layout untouched. It fits: the label runs 600-628, the bar
          // starts at 582 and the WhatsApp button at 640, so 592-636 clears both.
          className="relative text-sm text-primary hover:text-primary/80 transition-colors flex flex-shrink-0 items-center gap-1 whitespace-nowrap py-1 px-2 -mr-2 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
        >
{t('booking.showPriceDetails', 'Details')} <ChevronDown className="h-3 w-3" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('booking.priceDetails', 'Price Details')}</SheetTitle>
        </SheetHeader>
        
        {/* EVERY LABEL TRANSLATED. This drawer shipped with "Accommodation", "Additional Fees",
            "Cleaning fee", "Taxes", "Discounts", "Total" and "nights" hardcoded in English, on a page
            that is otherwise entirely Romanian — and it is the ONLY price breakdown a phone user can
            reach. The desktop <details> next to it was translated all along, so the keys already
            existed; nothing here is a new string. */}
        <div className="space-y-4">
          {/* Accommodation */}
          <div>
            <h3 className="font-medium mb-2">{t('booking.accommodation', 'Accommodation')}</h3>
            <div className="flex justify-between items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {formatPrice(convertToSelectedCurrency(pricing.accommodationTotal / nights, pricing.currency))} × {nights}{' '}
                {nights === 1 ? t('common.night', 'night') : t('common.nights', 'nights')}
              </span>
              <span className="text-sm font-medium tabular-nums">{formatPrice(convertToSelectedCurrency(pricing.accommodationTotal, pricing.currency))}</span>
            </div>
          </div>

          {/* Fees. `extraGuestFee` was missing entirely while the desktop breakdown showed it, so on
              any property that charges one the mobile numbers did not add up to the total. */}
          {(pricing.cleaningFee > 0 || (pricing.extraGuestFeeTotal && pricing.extraGuestFeeTotal > 0) || (pricing.taxes && pricing.taxes > 0)) && (
            <div className="space-y-2">
              <h3 className="font-medium">{t('booking.additionalFees', 'Additional fees')}</h3>
              {pricing.cleaningFee > 0 && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-sm text-muted-foreground">{t('booking.cleaningFee', 'Cleaning fee')}</span>
                  <span className="text-sm tabular-nums">{formatPrice(convertToSelectedCurrency(pricing.cleaningFee, pricing.currency))}</span>
                </div>
              )}
              {pricing.extraGuestFeeTotal && pricing.extraGuestFeeTotal > 0 && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-sm text-muted-foreground">{t('booking.extraGuestFee', 'Extra guest fee')}</span>
                  <span className="text-sm tabular-nums">{formatPrice(convertToSelectedCurrency(pricing.extraGuestFeeTotal, pricing.currency))}</span>
                </div>
              )}
              {pricing.taxes && pricing.taxes > 0 && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-sm text-muted-foreground">{t('booking.taxes', 'Taxes')}</span>
                  <span className="text-sm tabular-nums">{formatPrice(convertToSelectedCurrency(pricing.taxes, pricing.currency))}</span>
                </div>
              )}
            </div>
          )}

          {/* Discounts */}
          {((pricing.lengthOfStayDiscount && pricing.lengthOfStayDiscount.discountAmount > 0) || 
            (pricing.couponDiscount && pricing.couponDiscount.discountAmount > 0)) && (
            <div className="space-y-2">
              <h3 className="font-medium text-green-600">{t('booking.discounts', 'Discounts')}</h3>
              {pricing.lengthOfStayDiscount && pricing.lengthOfStayDiscount.discountAmount > 0 && (
                <div className="flex justify-between items-center gap-3 text-green-600">
                  <span className="text-sm">{t('booking.lengthOfStayDiscount', `Length of stay (${pricing.lengthOfStayDiscount.discountPercentage}%)`, { percentage: pricing.lengthOfStayDiscount.discountPercentage })}</span>
                  <span className="text-sm tabular-nums">-{formatPrice(convertToSelectedCurrency(pricing.lengthOfStayDiscount.discountAmount, pricing.currency))}</span>
                </div>
              )}
              {pricing.couponDiscount && pricing.couponDiscount.discountAmount > 0 && (
                <div className="flex justify-between items-center gap-3 text-green-600">
                  {/* `discountPercentage` is optional on couponDiscount (it is required on the
                      length-of-stay one), so it cannot just be interpolated. Rather than print
                      "Cupon (0%)" next to a real deduction, fall back to the coupon CODE, which the
                      type does guarantee and which needs no translation. */}
                  <span className="text-sm">
                    {pricing.couponDiscount.discountPercentage
                      ? t('booking.couponDiscount', `Coupon (${pricing.couponDiscount.discountPercentage}%)`, { percentage: pricing.couponDiscount.discountPercentage })
                      : pricing.couponDiscount.code}
                  </span>
                  <span className="text-sm tabular-nums">-{formatPrice(convertToSelectedCurrency(pricing.couponDiscount.discountAmount, pricing.currency))}</span>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-lg font-semibold">{t('booking.total', 'Total')}</span>
              <span className="text-lg font-semibold tabular-nums">{formatPrice(convertToSelectedCurrency(pricing.totalPrice || pricing.total, pricing.currency))}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('booking.allIncluded', 'all taxes included')}</p>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}