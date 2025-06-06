/**
 * BookingPageV2.5 - Redesigned Booking Page with Header and Currency Integration
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Main container for V2 booking page
 * @created: 2025-05-31
 * @updated: 2025-06-04 (V2.5 - Fixed currency consistency and removed redundant title)
 * @description: Orchestrates the complete V2 booking experience with simplified
 *               state management and preserved working components.
 *               V2.3 adds two-column desktop layout with sticky summary.
 *               V2.4 adds simple booking header with back navigation, currency and language selectors.
 *               V2.5 removes redundant property title, fixes hold fee currency conversion.
 * @dependencies: BookingProvider, existing form components, pricing display, CurrencyContext
 * @replaces: src/app/booking/check/[slug]/booking-client-layout.tsx (partially)
 * @v2.4-changes: Added mobile/desktop sticky headers with back button, currency/language selectors
 * @v2.5-changes: Removed duplicate property title, fixed hardcoded EUR hold fees to respect selected currency
 */

"use client";

import React from 'react';
import { BookingProvider } from '../contexts';
import { DateAndGuestSelector, PricingSummary } from '../components';
import { ContactFormV2, HoldFormV2, BookingFormV2 } from '../forms';
import type { Property, CurrencyCode } from '@/types';
import { loggers } from '@/lib/logger';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CurrencySwitcherSimple } from '@/components/currency-switcher-simple';
import { LanguageSelector } from '@/components/language-selector';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';

import { useBooking } from '../contexts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface BookingPageV2Props {
  property: Property;
  initialCurrency?: CurrencyCode;
  initialLanguage?: string;
  themeId?: string;
  className?: string;
}

// Internal component that uses the booking context
function BookingPageContent({ className }: { className?: string }) {
  const {
    property,
    checkInDate,
    checkOutDate,
    guestCount,
    pricing,
    selectedAction,
    setSelectedAction
  } = useBooking();
  
  const { formatPrice, convertToSelectedCurrency } = useCurrency();
  const { t, currentLang } = useLanguage();

  // Form state will be added when we create V2 forms

  // Check if we have valid booking data
  const hasValidDates = checkInDate && checkOutDate;
  const hasValidPricing = pricing && pricing.totalPrice > 0;
  const canShowBookingOptions = hasValidDates && hasValidPricing;

  const propertyName = typeof property.name === 'string' ? property.name : property.name.en;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sticky Header - Clean Navigation Only */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border md:hidden">
        <div className="container px-4 py-3">
          <div className="flex items-center gap-3">
            <Link 
              href={`/properties/${property.slug}`}
              className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span>{t('common.back', 'Back')}</span>
            </Link>
            <div className="flex-1 text-center">
              <h1 className="text-sm font-medium truncate text-foreground">{propertyName}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Summary Bar - Shows when dates selected with currency/language controls */}
      {hasValidDates && (
        <div className="sticky top-16 z-30 bg-background/90 backdrop-blur border-b border-border/50 md:hidden">
          <div className="container px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {checkInDate && checkOutDate && (
                  <div className="text-xs text-muted-foreground">
                    {format(checkInDate, 'MMM d', { locale: currentLang === 'ro' ? ro : undefined })} - {format(checkOutDate, 'MMM d', { locale: currentLang === 'ro' ? ro : undefined })} • {guestCount} {guestCount === 1 ? t('booking.guest', 'guest') : t('booking.guests', 'guests')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <CurrencySwitcherSimple variant="booking" />
                <LanguageSelector variant="booking" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      <div className="hidden md:block border-b border-border bg-background">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <Link 
              href={`/properties/${property.slug}`}
              className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span>{t('navigation.backTo', 'Back to {{property}}', { property: propertyName })}</span>
            </Link>
            <div className="flex items-center gap-3">
              <CurrencySwitcherSimple variant="booking" />
              <LanguageSelector variant="booking" />
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 ${className}`}>
        {/* V2.3 Responsive Layout: Desktop 60/40, Mobile single column */}
      <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Left Column: 60% - Booking inputs and forms */}
        <div className="lg:col-span-3 space-y-6">
          {/* Date & Guest Selection */}
          <DateAndGuestSelector />
          
          {/* Inline Form Container - V2.3 */}
          {selectedAction && pricing && (
            <div className="space-y-4">
              {/* Form Header with Back Button */}
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base sm:text-lg font-semibold">
                  {selectedAction === 'contact' && t('booking.sendMessageToHost', 'Send a Message to the Host')}
                  {selectedAction === 'hold' && t('booking.holdYourStay', 'Hold Your Stay')}
                  {selectedAction === 'book' && t('booking.completeYourBooking', 'Complete Your Booking')}
                </h2>
                <button 
                  type="button"
                  onClick={() => setSelectedAction(null)}
                  className="text-sm text-primary underline hover:no-underline whitespace-nowrap"
                >
                  {t('navigation.backToOptions', 'Back to options')}
                </button>
              </div>

              {/* Form Content */}
              {selectedAction === 'contact' && (
                <ContactFormV2
                  onSubmit={async (values, pricingDetails, selectedCurrency) => {
                    loggers.bookingContext.debug('[V2] Contact form submission started', { values });
                    
                    const { createInquiryAction } = await import('@/app/actions/createInquiryAction');
                    
                    const result = await createInquiryAction({
                      propertySlug: property.slug,
                      checkInDate: checkInDate!.toISOString(),
                      checkOutDate: checkOutDate!.toISOString(),
                      guestCount,
                      guestInfo: {
                        firstName: values.firstName,
                        lastName: values.lastName,
                        email: values.email,
                        phone: values.phone
                      },
                      message: values.message,
                      totalPrice: pricingDetails?.totalPrice,
                      currency: selectedCurrency as any
                    });
                    
                    if (result.error) {
                      loggers.bookingContext.error('[V2] Contact form submission failed', { error: result.error });
                      // TODO: Show error to user
                    } else {
                      loggers.bookingContext.info('[V2] Contact form submitted successfully', { inquiryId: result.inquiryId });
                      // TODO: Show success message or redirect
                    }
                  }}
                  isProcessing={false}
                  isPending={false}
                  pricingDetails={pricing}
                  selectedCurrency="USD" // TODO: Get from currency context
                />
              )}

              {selectedAction === 'hold' && (
                <HoldFormV2
                  onSubmit={async (values, _pricingDetails, selectedCurrency) => {
                    loggers.bookingContext.debug('[V2] Hold form submission started', { values });
                    
                    const { createHoldBookingAction } = await import('@/app/actions/createHoldBookingAction');
                    
                    const holdResult = await createHoldBookingAction({
                      propertySlug: property.slug,
                      checkInDate: checkInDate!.toISOString(),
                      checkOutDate: checkOutDate!.toISOString(),
                      guestCount,
                      guestInfo: {
                        firstName: values.firstName,
                        lastName: values.lastName,
                        email: values.email,
                        phone: values.phone
                      },
                      holdFeeAmount: property.holdFeeAmount || 50,
                      selectedCurrency
                    });
                    
                    if (holdResult.error || !holdResult.bookingId) {
                      loggers.bookingContext.error('[V2] Hold booking creation failed', { error: holdResult.error });
                      return;
                    }
                    
                    const { createHoldCheckoutSession } = await import('@/app/actions/createHoldCheckoutSession');
                    
                    const checkoutResult = await createHoldCheckoutSession({
                      property,
                      holdBookingId: holdResult.bookingId,
                      holdFeeAmount: property.holdFeeAmount || 50,
                      guestEmail: values.email,
                      selectedCurrency: selectedCurrency as any
                    });
                    
                    if (checkoutResult.error || !checkoutResult.sessionUrl) {
                      loggers.bookingContext.error('[V2] Hold checkout session creation failed', { error: checkoutResult.error });
                      return;
                    }
                    
                    loggers.bookingContext.info('[V2] Redirecting to Stripe for hold payment', { sessionId: checkoutResult.sessionId });
                    window.location.href = checkoutResult.sessionUrl;
                  }}
                  isProcessing={false}
                  isPending={false}
                  pricingDetails={pricing}
                  selectedCurrency="USD"
                />
              )}

              {selectedAction === 'book' && (
                <BookingFormV2
                  onSubmit={async (values, pricingDetails, appliedCoupon, selectedCurrency) => {
                    loggers.bookingContext.debug('[V2] Booking form submission started', { values });
                    
                    const { createPendingBookingAction } = await import('@/app/actions/booking-actions');
                    
                    const bookingResult = await createPendingBookingAction({
                      propertyId: property.slug,
                      guestInfo: {
                        firstName: values.firstName,
                        lastName: values.lastName,
                        email: values.email,
                        phone: values.phone
                      },
                      checkInDate: checkInDate!.toISOString(),
                      checkOutDate: checkOutDate!.toISOString(),
                      numberOfGuests: guestCount,
                      pricing: {
                        baseRate: pricingDetails!.baseRate,
                        numberOfNights: pricingDetails!.numberOfNights,
                        cleaningFee: pricingDetails!.cleaningFee || 0,
                        extraGuestFee: pricingDetails!.extraGuestFee,
                        numberOfExtraGuests: pricingDetails!.numberOfExtraGuests,
                        accommodationTotal: pricingDetails!.accommodationTotal,
                        subtotal: pricingDetails!.subtotal,
                        taxes: pricingDetails!.taxes,
                        discountAmount: pricingDetails!.discountAmount,
                        total: pricingDetails!.totalPrice,
                        currency: selectedCurrency as any
                      },
                      status: 'pending',
                      appliedCouponCode: appliedCoupon?.code || null
                    });
                    
                    if (bookingResult.error || !bookingResult.bookingId) {
                      loggers.bookingContext.error('[V2] Pending booking creation failed', { error: bookingResult.error });
                      return;
                    }
                    
                    const { createCheckoutSession } = await import('@/app/actions/create-checkout-session');
                    
                    const checkoutResult = await createCheckoutSession({
                      property,
                      checkInDate: checkInDate!.toISOString(),
                      checkOutDate: checkOutDate!.toISOString(),
                      numberOfGuests: guestCount,
                      totalPrice: pricingDetails!.totalPrice,
                      numberOfNights: pricingDetails!.numberOfNights,
                      guestFirstName: values.firstName,
                      guestLastName: values.lastName,
                      guestEmail: values.email,
                      appliedCouponCode: appliedCoupon?.code,
                      discountPercentage: appliedCoupon?.discountPercentage,
                      pendingBookingId: bookingResult.bookingId,
                      selectedCurrency: selectedCurrency as any
                    });
                    
                    if (checkoutResult.error || !checkoutResult.sessionUrl) {
                      loggers.bookingContext.error('[V2] Booking checkout session creation failed', { error: checkoutResult.error });
                      return;
                    }
                    
                    loggers.bookingContext.info('[V2] Redirecting to Stripe for booking payment', { sessionId: checkoutResult.sessionId });
                    window.location.href = checkoutResult.sessionUrl;
                  }}
                  isProcessing={false}
                  isPending={false}
                  pricingDetails={pricing}
                  selectedCurrency="USD"
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column: 40% Desktop - Full width Mobile */}
        <div className="lg:col-span-2">
          {/* Mobile: Summary and actions in order */}
          <div className="lg:hidden space-y-4">
            {/* Mobile Summary - Above actions */}
            <PricingSummary
              pricing={pricing}
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              guestCount={guestCount}
              property={property}
              show={hasValidPricing}
            />

            {/* Mobile Action Buttons - Full width */}
            {canShowBookingOptions && pricing && !selectedAction && (
              <div className="space-y-3">
                {/* Book Now - Primary */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('book')}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 rounded-md font-medium transition-colors text-base"
                >
                  {t('booking.bookNow', 'Book Now')}
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  {t('host.secureBookingInstantly', 'Secure your booking instantly')}
                </p>

                {/* Hold Dates - Secondary */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('hold')}
                  className="w-full border border-primary text-primary hover:bg-primary/10 h-12 px-6 rounded-md font-medium transition-colors text-base"
                >
                  {t('booking.holdDates', 'Hold Dates')}
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  {t('booking.holdDescription', '24h hold for {{fee}} – applied to your total if you book', {
                    fee: formatPrice(convertToSelectedCurrency(property.holdFeeAmount || 50, 'EUR'))
                  })}
                </p>

                {/* Contact Host - Ghost */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('contact')}
                  className="w-full text-primary hover:text-primary/80 hover:bg-accent h-12 px-6 rounded-md font-medium transition-colors text-base"
                >
                  {t('booking.contactHost', 'Contact Host')}
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  {t('host.askQuestionBeforeBooking', 'Ask a question before booking')}
                </p>
              </div>
            )}
          </div>

          {/* Desktop: Sticky sidebar */}
          <div className="hidden lg:block lg:sticky lg:top-4 space-y-6">
            {/* Desktop Summary */}
            <PricingSummary
              pricing={pricing}
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              guestCount={guestCount}
              property={property}
              show={hasValidPricing}
            />

            {/* Desktop Action Buttons - V2.3 vertical stack */}
            {canShowBookingOptions && pricing && !selectedAction && (
              <div className="space-y-3">
                {/* Book Now - Primary */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('book')}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 rounded-md font-medium transition-colors"
                >
                  {t('booking.bookNow', 'Book Now')}
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  {t('host.secureBookingInstantly', 'Secure your booking instantly')}
                </p>

                {/* Hold Dates - Secondary */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('hold')}
                  className="w-full border border-primary text-primary hover:bg-primary/10 h-11 px-8 rounded-md font-medium transition-colors"
                >
                  {t('booking.holdDates', 'Hold Dates')}
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  {t('booking.holdDescription', '24h hold for {{fee}} – applied to your total if you book', {
                    fee: formatPrice(convertToSelectedCurrency(property.holdFeeAmount || 50, 'EUR'))
                  })}
                </p>

                {/* Contact Host - Ghost */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('contact')}
                  className="w-full text-primary hover:text-primary/80 hover:bg-accent h-11 px-8 rounded-md font-medium transition-colors"
                >
                  {t('booking.contactHost', 'Contact Host')}
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  {t('host.askQuestionBeforeBooking', 'Ask a question before booking')}
                </p>
              </div>
            )}

            {/* Helper Text for Empty States */}
            {!hasValidDates && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">{t('booking.selectDatesForPricing', 'Select your dates to see pricing and booking options')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// Main component that provides the booking context
export function BookingPageV2({ 
  property, 
  initialCurrency, 
  initialLanguage,
  themeId,
  className 
}: BookingPageV2Props) {
  const { setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  
  // Prevent hydration issues by waiting for client mount
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Apply property theme only after hydration is complete
  useEffect(() => {
    if (isMounted && themeId && themeId !== 'airbnb') {
      console.log(`🎨 [V2] Applying property theme: ${themeId}`);
      setTheme(themeId);
    }
  }, [isMounted, themeId, setTheme]);

  return (
    <BookingProvider
      property={property}
      initialCurrency={initialCurrency}
    >
      <BookingPageContent className={className} />
    </BookingProvider>
  );
}