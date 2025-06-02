/**
 * BookingPageV2.3 - Redesigned Booking Page
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Main container for V2 booking page
 * @created: 2025-05-31
 * @updated: 2025-06-02 (V2.3 - Desktop layout restructure)
 * @description: Orchestrates the complete V2 booking experience with simplified
 *               state management and preserved working components.
 *               V2.3 adds two-column desktop layout with sticky summary.
 * @dependencies: BookingProvider, existing form components, pricing display
 * @replaces: src/app/booking/check/[slug]/booking-client-layout.tsx (partially)
 */

"use client";

import React from 'react';
import { BookingProvider } from '../contexts';
import { DateAndGuestSelector, PricingSummary } from '../components';
import { ContactFormV2, HoldFormV2, BookingFormV2 } from '../forms';
import type { Property, CurrencyCode } from '@/types';
import { loggers } from '@/lib/logger';

import { useBooking } from '../contexts';

interface BookingPageV2Props {
  property: Property;
  initialCurrency?: CurrencyCode;
  initialLanguage?: string;
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

  // Form state will be added when we create V2 forms

  // Check if we have valid booking data
  const hasValidDates = checkInDate && checkOutDate;
  const hasValidPricing = pricing && pricing.totalPrice > 0;
  const canShowBookingOptions = hasValidDates && hasValidPricing;

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {/* Property Title - V2.3 moved to top */}
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 md:mb-8">
        {typeof property.name === 'string' ? property.name : property.name.en}
      </h1>

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
                  {selectedAction === 'contact' && 'Send a Message to the Host'}
                  {selectedAction === 'hold' && 'Hold Your Stay'}
                  {selectedAction === 'book' && 'Complete Your Booking'}
                </h2>
                <button 
                  type="button"
                  onClick={() => setSelectedAction(null)}
                  className="text-sm text-primary underline hover:no-underline whitespace-nowrap"
                >
                  Back to options
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
                  Book Now
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  Secure your booking instantly
                </p>

                {/* Hold Dates - Secondary */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('hold')}
                  className="w-full border border-primary text-primary hover:bg-primary/10 h-12 px-6 rounded-md font-medium transition-colors text-base"
                >
                  Hold Dates
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  24h hold for {property.holdFeeAmount ? `€${property.holdFeeAmount}` : '€50'} – applied to your total if you book
                </p>

                {/* Contact Host - Ghost */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('contact')}
                  className="w-full text-primary hover:text-primary/80 hover:bg-accent h-12 px-6 rounded-md font-medium transition-colors text-base"
                >
                  Contact Host
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  Ask a question before booking
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
                  Book Now
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  Secure your booking instantly
                </p>

                {/* Hold Dates - Secondary */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('hold')}
                  className="w-full border border-primary text-primary hover:bg-primary/10 h-11 px-8 rounded-md font-medium transition-colors"
                >
                  Hold Dates
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  24h hold for {property.holdFeeAmount ? `€${property.holdFeeAmount}` : '€50'} – applied to your total if you book
                </p>

                {/* Contact Host - Ghost */}
                <button
                  type="button"
                  onClick={() => setSelectedAction('contact')}
                  className="w-full text-primary hover:text-primary/80 hover:bg-accent h-11 px-8 rounded-md font-medium transition-colors"
                >
                  Contact Host
                </button>
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  Ask a question before booking
                </p>
              </div>
            )}

            {/* Helper Text for Empty States */}
            {!hasValidDates && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Select your dates to see pricing and booking options</p>
              </div>
            )}
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
  className 
}: BookingPageV2Props) {
  return (
    <BookingProvider
      property={property}
      initialCurrency={initialCurrency}
      initialLanguage={initialLanguage}
    >
      <BookingPageContent className={className} />
    </BookingProvider>
  );
}