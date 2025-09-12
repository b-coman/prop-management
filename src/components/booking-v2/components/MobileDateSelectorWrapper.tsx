/**
 * MobileDateSelectorWrapper - Mobile-specific collapsed/expanded wrapper
 * 
 * @file-status: ACTIVE
 * @v2-role: MOBILE - Wrapper for mobile date selector collapse/expand UX
 * @created: 2025-09-12
 * @description: Provides mobile-only collapsed banner state for valid dates,
 *               keeping existing DateAndGuestSelector completely unchanged.
 *               Shows collapsed summary when dates are available, expands to 
 *               full interface when needed.
 * @dependencies: DateAndGuestSelector (unchanged), BookingContext
 */

"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useBooking } from '../contexts';
import { useLanguage } from '@/lib/language-system';
import { DateAndGuestSelector } from './DateAndGuestSelector';
import { cn } from '@/lib/utils';

interface MobileDateSelectorWrapperProps {
  className?: string;
}

export function MobileDateSelectorWrapper({ className }: MobileDateSelectorWrapperProps) {
  const { t, currentLang } = useLanguage();
  const {
    checkInDate,
    checkOutDate,
    guestCount,
    pricing,
    isLoadingPricing,
    pricingError
  } = useBooking();

  const [isExpanded, setIsExpanded] = useState(false);

  // Check if we're in "green" state - dates available and valid pricing
  const hasValidDates = checkInDate && checkOutDate;
  const hasValidPricing = !!(pricing && pricing.totalPrice > 0);
  const isGreenState = !!(hasValidDates && hasValidPricing && !isLoadingPricing && !pricingError);

  // Calculate nights for display
  const numberOfNights = hasValidDates 
    ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Format dates for display
  const formatDateRange = () => {
    if (!hasValidDates) return '';
    
    const locale = currentLang === 'ro' ? ro : undefined;
    const startDate = format(checkInDate, 'MMM d', { locale });
    const endDate = format(checkOutDate, 'MMM d', { locale });
    
    return `${startDate}-${endDate}`;
  };

  // Mobile collapsed banner (only show in green state)
  if (isGreenState && !isExpanded) {
    return (
      <div className={cn("md:hidden", className)}>
        {/* Sticky Collapsed Banner */}
        <div className="sticky top-[73px] z-30 bg-background border-b border-border/50 shadow-sm">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="text-sm font-medium truncate">
                {formatDateRange()} • {numberOfNights} {numberOfNights === 1 ? t('booking.night', 'night') : t('booking.nights', 'nights')} • {guestCount} {guestCount === 1 ? t('booking.guest', 'guest') : t('booking.guests', 'guests')}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <span className="text-xs text-muted-foreground">{t('booking.tapToChange', 'Change')}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // For mobile: Either expanded state or non-green state - Mobile view
  return (
    <>
      {/* Mobile View */}
      <div className={cn("md:hidden", className)}>
        {/* Expanded Header (only in green state when expanded) */}
        {isGreenState && isExpanded && (
          <div className="sticky top-[73px] z-30 bg-background border-b border-border/50">
            <button
              onClick={() => setIsExpanded(false)}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="text-sm font-medium text-left">
                {t('booking.changeDatesAndGuests', 'Change dates and guests')}
              </div>
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
        
        {/* Full DateAndGuestSelector - completely unchanged */}
        <div className={cn(
          "transition-all duration-300 ease-in-out",
          isGreenState && !isExpanded ? "hidden" : "block"
        )}>
          <DateAndGuestSelector />
        </div>
      </div>

      {/* Desktop: Always show full component unchanged */}
      <div className={cn("hidden md:block", className)}>
        <DateAndGuestSelector />
      </div>
    </>
  );
}