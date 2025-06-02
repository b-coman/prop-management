/**
 * PricingSummary V2.3 - Enhanced Collapsible Pricing Display
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Displays pricing information for V2 booking system
 * @created: 2025-05-31
 * @updated: 2025-06-02 (V2.3 - Updated collapsible UI for V2.3 design spec)
 * @description: Clean, simplified pricing summary that consumes V2 booking state
 *               and displays pricing information with currency conversion.
 *               V2.1 prevents card flashing when state changes.
 *               V2.2 adds collapsible UI with simple summary and expandable details.
 *               V2.3 refines the UI to match the new design specification.
 * @dependencies: BookingProvider, CurrencyContext
 */

"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Users, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatDateRange } from '../utils';
import { format } from 'date-fns';
import type { Property, PricingResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MobilePriceDrawer } from './MobilePriceDrawer';

interface PricingSummaryProps {
  property: Property;
  pricing: PricingResponse | null;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guestCount: number;
  className?: string;
  show?: boolean;
}

export function PricingSummary({
  property,
  pricing,
  checkInDate,
  checkOutDate,
  guestCount,
  className,
  show = true
}: PricingSummaryProps) {
  const { formatPrice, selectedCurrency } = useCurrency();
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate nights
  const nights = pricing?.numberOfNights || 1;

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardContent className="pt-6">
          {show && pricing && checkInDate && checkOutDate ? (
            <>
              {/* V2.3 Total Price Overview with tooltip */}
              <div className="space-y-4">
                <div className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <p className="text-2xl lg:text-3xl font-bold">
                          Total: {formatPrice(pricing.totalPrice || pricing.total, pricing.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="hidden lg:inline">{nights} {nights === 1 ? 'night' : 'nights'} · {formatDateRange(checkInDate, checkOutDate)}</span>
                          <span className="lg:hidden">{nights} {nights === 1 ? 'night' : 'nights'} · {checkInDate && checkOutDate && `${format(checkInDate, 'MMM d')} - ${format(checkOutDate, 'MMM d')}`}</span>
                          <span className="block lg:hidden text-xs">Incl. all fees</span>
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Includes cleaning, service, and taxes</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Desktop: Expandable Price Breakdown */}
                <div className="hidden lg:block">
                  <button
                    type="button"
                    className="w-full text-sm text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-2"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? (
                      <>Hide price breakdown <ChevronUp className="h-3 w-3" /></>
                    ) : (
                      <>Show full price breakdown <ChevronDown className="h-3 w-3" /></>
                    )}
                  </button>
                </div>

                {/* Mobile: Bottom Drawer */}
                <div className="lg:hidden">
                  <MobilePriceDrawer
                    property={property}
                    pricing={pricing}
                    checkInDate={checkInDate}
                    checkOutDate={checkOutDate}
                    guestCount={guestCount}
                    nights={nights}
                  />
                </div>
              </div>

              {/* Expandable Details - V2.3 simplified with animation */}
              <div 
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-out",
                  isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="mt-4 space-y-3 border-t pt-4">
                  {/* Accommodation */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      {formatPrice(pricing.accommodationTotal / nights, pricing.currency)} × {nights} {nights === 1 ? 'night' : 'nights'}
                    </span>
                    <span className="text-sm">{formatPrice(pricing.accommodationTotal, pricing.currency)}</span>
                  </div>

                  {/* Cleaning Fee with tooltip */}
                  {pricing.cleaningFee > 0 && (
                    <div className="flex justify-between items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm cursor-help underline decoration-dotted">Cleaning Fee</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Covers professional turnover service</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-sm">{formatPrice(pricing.cleaningFee, pricing.currency)}</span>
                    </div>
                  )}

                  {/* Taxes */}
                  {pricing.taxes > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Taxes</span>
                      <span className="text-sm">{formatPrice(pricing.taxes, pricing.currency)}</span>
                    </div>
                  )}

                  {/* Discounts */}
                  {pricing.lengthOfStayDiscount && pricing.lengthOfStayDiscount.discountAmount > 0 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-sm">Length of stay discount ({pricing.lengthOfStayDiscount.discountPercentage}%)</span>
                      <span className="text-sm">-{formatPrice(pricing.lengthOfStayDiscount.discountAmount, pricing.currency)}</span>
                    </div>
                  )}

                  {pricing.couponDiscount && pricing.couponDiscount.discountAmount > 0 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-sm">Coupon discount ({pricing.couponDiscount.discountPercentage}%)</span>
                      <span className="text-sm">-{formatPrice(pricing.couponDiscount.discountAmount, pricing.currency)}</span>
                    </div>
                  )}

                  {/* Separator before total */}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total</span>
                      <span>{formatPrice(pricing.totalPrice || pricing.total, pricing.currency)}</span>
                    </div>
                  </div>

                  {/* Currency Notice */}
                  {pricing.currency !== selectedCurrency && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Prices shown in {pricing.currency}. Will be converted to {selectedCurrency} at checkout.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}