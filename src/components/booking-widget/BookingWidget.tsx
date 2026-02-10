/**
 * BookingWidget - Embedded booking widget for hero sections
 *
 * @description Displays price and date picker, redirects to V2 booking page.
 *              Standalone component extracted from V1 booking system during cleanup.
 * @created 2026-02-04
 * @module components/booking-widget
 */

"use client";

import React, { useEffect, useState } from 'react';
import { InitialBookingForm } from './InitialBookingForm';
import { Star, Users, BedDouble, Bath } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLanguage } from '@/hooks/useLanguage';
import type { Property } from '@/types';

export interface BookingWidgetProps {
  property: Property;
  position?: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: 'compressed' | 'large';
  showRating?: boolean;
  variant?: 'embedded' | 'standalone';
  className?: string;
}

/**
 * Embedded booking widget for hero sections
 * Displays price and date picker, redirects to V2 booking page
 */
export const BookingWidget = React.memo(function BookingWidget({
  property,
  position = 'bottom',
  size = 'compressed',
  showRating = false,
  variant = 'embedded',
  className
}: BookingWidgetProps) {
  const { formatPrice, selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, ratesLoading } = useCurrency();
  const { tc, t } = useLanguage();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Only embedded variant is supported
  if (variant !== 'embedded') {
    console.warn('[BookingWidget] Only embedded variant is supported. Use V2 booking page for full booking flow.');
    return null;
  }

  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency || 'EUR');

  // Convert the property's advertised price to the selected display currency
  const displayPriceAmount = property.advertisedRate !== null &&
                           property.advertisedRate !== undefined &&
                           !ratesLoading &&
                           hasMounted
    ? convertToSelectedCurrency(property.advertisedRate, propertyBaseCcy)
    : property.advertisedRate;

  const currencyToDisplay = !hasMounted || ratesLoading ? propertyBaseCcy : selectedCurrency;

  const roundedPrice = displayPriceAmount !== null && displayPriceAmount !== undefined
    ? Math.round(displayPriceAmount)
    : null;

  const formattedDisplayPrice = roundedPrice !== null
    ? formatPrice(roundedPrice, currencyToDisplay)
    : null;

  // Use property ratings if available
  const rating = property.ratings?.average;
  const reviewsCount = property.ratings?.count;

  // Base classes for the container
  const containerClasses = cn(
    'bg-background/80 backdrop-blur-sm rounded-xl w-full',
    'shadow-xl ring-1 ring-black/5',
    'transition-all duration-300 ease-in-out',
    size === 'large' ? 'p-6 md:p-8' : 'p-4 md:p-6',
    'mx-auto',
    className
  );

  return (
    <div
      className={containerClasses}
      data-position={position}
      data-size={size}
    >
      {/* Inject CSS for consistent layout regardless of theme */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Theme-agnostic responsive styling */
        [data-position="${position}"][data-size="${size}"] {
          box-sizing: border-box !important;
        }

        /* Custom padding for booking form cards */
        .booking-form-card {
          /* No padding on card itself */
        }

        .booking-form-card > div:first-child,
        .booking-form-card > div:last-child {
          padding: 1rem !important;
        }

        .booking-form-card > div:last-child {
          padding-top: 0 !important;
        }

        /* Embedded variant in hero section - reduce vertical padding */
        [data-position="${position}"][data-size="${size}"] {
          padding-top: 0.75rem !important;
          padding-bottom: 0.75rem !important;
          padding-left: 0.75rem !important;
          padding-right: 0.75rem !important;
        }

        @media (min-width: 768px) {
          [data-position="${position}"][data-size="${size}"] {
            padding-top: 1rem !important;
            padding-bottom: 1rem !important;
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }
        }

        /* Force horizontal layout for large size on all screens */
        ${size === 'large' ? `
          .booking-form-flex-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 16px !important;
            width: 100% !important;
          }

          @media (min-width: 768px) {
            .booking-form-flex-container {
              flex-direction: row !important;
              flex-wrap: nowrap !important;
              align-items: flex-end !important;
              justify-content: flex-start !important;
              gap: 24px !important;
            }
          }`
        : `
          .booking-form-flex-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
          }

          @media (min-width: 768px) {
            .booking-form-flex-container {
              flex-direction: row !important;
              flex-wrap: wrap !important;
              align-items: flex-end !important;
              justify-content: flex-start !important;
              gap: 6px !important;
            }
          }
        `}

          /* Common styles for all layouts - Mobile First Unified Width */
          .booking-price-container {
            flex-shrink: 0 !important;
            width: 100% !important;
            max-width: 280px !important;
            margin: 0 auto !important;
            text-align: center !important;
          }

          @media (min-width: 768px) {
            .booking-price-container {
              width: auto !important;
              max-width: none !important;
              margin: 0 !important;
              margin-right: ${size === 'large' ? '20px' : '12px'} !important;
              text-align: left !important;
            }
          }

          /* Booking form container - Mobile First Unified Width */
          .booking-form-wrapper {
            width: 100% !important;
            max-width: 280px !important;
            margin: 0 auto !important;
            overflow: hidden !important;
          }

          @media (min-width: 768px) {
            .booking-form-wrapper {
              flex: 1 !important;
              min-width: 280px !important;
              max-width: none !important;
              margin: 0 !important;
            }
          }

          /* InitialBookingForm container - Mobile First with Center Alignment */
          .InitialBookingForm {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 12px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          @media (min-width: 768px) {
            .InitialBookingForm {
              flex-direction: row !important;
              align-items: flex-end !important;
              gap: ${size === 'large' ? '8px' : '6px'} !important;
            }
          }

          /* Form elements - Mobile First Unified Width */
          .InitialBookingForm > div:first-child,
          .InitialBookingForm > div:last-child {
            width: 100% !important;
            max-width: 280px !important;
            margin: 0 auto !important;
          }

          /* Mobile-specific content alignment overrides */
          @media (max-width: 767px) {
            .booking-price-container * {
              text-align: center !important;
            }

            .InitialBookingForm > div:first-child,
            .InitialBookingForm > div:last-child {
              width: 280px !important;
              max-width: 280px !important;
            }

            .InitialBookingForm > div:first-child > div,
            .InitialBookingForm > div:first-child > div > button,
            #date {
              width: 280px !important;
              max-width: 280px !important;
              justify-content: center !important;
              text-align: center !important;
            }

            .InitialBookingForm > div:last-child > div,
            .InitialBookingForm > div:last-child > div > button,
            #check-availability-btn {
              width: 280px !important;
              max-width: 280px !important;
            }

            #date span {
              text-align: center !important;
            }
          }

          @media (min-width: 768px) {
            .InitialBookingForm > div:first-child,
            .InitialBookingForm > div:last-child {
              flex: 1 !important;
              width: 50% !important;
              max-width: 50% !important;
              min-width: 0 !important;
              margin: 0 !important;
            }
          }

          #check-availability-btn {
            width: 100% !important;
            padding-left: ${size === 'large' ? '24px' : '12px'} !important;
            padding-right: ${size === 'large' ? '24px' : '12px'} !important;
            font-size: ${size === 'large' ? '13px' : '11px'} !important;
            height: ${size === 'large' ? '44px' : '38px'} !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .InitialBookingForm > div:first-child > div,
          .InitialBookingForm > div:first-child > div > *,
          .InitialBookingForm > div:last-child > div,
          .InitialBookingForm > div:last-child > div > * {
            width: 100% !important;
          }

          #date,
          #check-availability-btn {
            width: 100% !important;
            height: ${size === 'large' ? '44px' : '38px'} !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            border-width: 1px !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: ${size === 'large' ? '14px' : '13px'} !important;
          }

          #date {
            border-color: hsl(var(--border)) !important;
            background-color: hsl(var(--background)) !important;
            color: hsl(var(--foreground)) !important;
          }

          #check-availability-btn {
            border-color: transparent !important;
            background-color: hsl(var(--primary)) !important;
            color: hsl(var(--primary-foreground)) !important;
          }
        }

        @media (min-width: 1024px) {
          .booking-form-flex-container {
            gap: 20px !important;
          }

          .booking-price-container {
            margin-right: 16px !important;
          }

          .InitialBookingForm {
            gap: 20px !important;
          }

          .InitialBookingForm > div:first-child,
          .InitialBookingForm > div:last-child {
            flex: 1 !important;
            width: 50% !important;
            max-width: 50% !important;
            min-width: 0 !important;
          }

          #date {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          #check-availability-btn {
            font-size: 12px !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
        }

        @media (min-width: 1280px) {
          .InitialBookingForm > div:first-child,
          .InitialBookingForm > div:last-child {
            flex: 1 !important;
            width: 50% !important;
            max-width: 50% !important;
            min-width: 0 !important;
          }

          #check-availability-btn {
            font-size: 13px !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
        }
      `}} />

      {/* Flex container for price and form */}
      <div className="booking-form-flex-container w-full">
        {/* Mobile: Property specs row */}
        {(property.maxGuests || property.bedrooms || property.bathrooms) && (
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground w-full md:hidden">
            {property.maxGuests && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {property.maxGuests} {t('specs.guests', 'guests')}
              </span>
            )}
            {property.bedrooms && (
              <>
                <span className="opacity-60">&middot;</span>
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3 w-3" /> {property.bedrooms} {property.bedrooms === 1 ? t('specs.bedroom', 'bedroom') : t('specs.bedrooms', 'bedrooms')}
                </span>
              </>
            )}
            {property.bathrooms && (
              <>
                <span className="opacity-60">&middot;</span>
                <span className="flex items-center gap-1">
                  <Bath className="h-3 w-3" /> {property.bathrooms} {property.bathrooms === 1 ? t('specs.bathroom', 'bath') : t('specs.bathrooms', 'baths')}
                </span>
              </>
            )}
          </div>
        )}

        {/* Price Section */}
        <div className="booking-price-container">
          <div className="flex flex-col items-start justify-end">
            {/* Desktop: FROM on separate line - left aligned */}
            <p className={cn(
              "text-muted-foreground uppercase tracking-wider mb-1 hidden md:block text-left",
              size === 'large' ? "text-sm" : "text-xs"
            )}>
              {typeof property.advertisedRateType === 'object'
                ? tc(property.advertisedRateType)
                : t('common.from')}
            </p>

            {/* Mobile: Price + Rating on one line */}
            <div className="flex items-center justify-between w-full md:hidden">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {typeof property.advertisedRateType === 'object'
                    ? tc(property.advertisedRateType)
                    : t('common.from')}
                </span>
                <span className="font-bold text-foreground text-lg leading-none">
                  {hasMounted && formattedDisplayPrice !== null
                    ? formattedDisplayPrice
                    : (property.advertisedRate ? formatPrice(Math.round(property.advertisedRate), propertyBaseCcy) : "...")}
                </span>
                <span className="text-sm text-muted-foreground font-normal">/{t('common.night')}</span>
              </div>
              {showRating && rating && reviewsCount && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 text-primary fill-primary" />
                  <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
                  <span className="text-foreground/70 text-xs">({reviewsCount})</span>
                </div>
              )}
            </div>

            {/* Desktop: price on separate line */}
            <p className={cn(
              "font-bold text-foreground leading-none hidden md:block",
              size === 'large' ? "text-3xl md:text-4xl" : "text-2xl md:text-2xl lg:text-3xl"
            )}>
              {hasMounted && formattedDisplayPrice !== null
                ? formattedDisplayPrice
                : (property.advertisedRate ? formatPrice(Math.round(property.advertisedRate), propertyBaseCcy) : "Loading price...")}
              <span className={cn(
                "font-normal text-muted-foreground ml-1",
                size === 'large' ? "text-base" : "text-sm"
              )}>/{t('common.night')}</span>
            </p>
          </div>
        </div>

        {/* Booking Form */}
        <div className="booking-form-wrapper max-w-full overflow-hidden">
          <InitialBookingForm
            property={property}
            size={size as 'compressed' | 'large'}
          />
        </div>

        {/* Ratings - desktop only (mobile has it inline with price) */}
        {showRating && rating && reviewsCount && (
          <div className="booking-rating-container hidden md:flex items-center gap-1 text-foreground self-end ml-4">
            <Star className="h-5 w-5 text-primary fill-primary" />
            <span className="font-semibold">{rating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({reviewsCount} reviews)</span>
          </div>
        )}
      </div>
    </div>
  );
});
