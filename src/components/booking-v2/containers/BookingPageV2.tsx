/**
 * BookingPageV2.6 - Enhanced UX with Tab-Based Forms and Improved Visual Hierarchy
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Main container for V2 booking page
 * @created: 2025-05-31
 * @updated: 2025-09-06 (V2.6 - Tab-based forms, improved layout, fixed language consistency)
 * @description: Orchestrates the complete V2 booking experience with simplified
 *               state management and preserved working components.
 *               V2.3 adds two-column desktop layout with sticky summary.
 *               V2.4 adds simple booking header with back navigation, currency and language selectors.
 *               V2.5 removes redundant property title, fixes hold fee currency conversion.
 *               V2.6 implements tab-based form navigation, better visual hierarchy, and language consistency.
 * @dependencies: BookingProvider, existing form components, pricing display, CurrencyContext
 * @replaces: src/app/booking/check/[slug]/booking-client-layout.tsx (partially)
 * @v2.6-changes: Tab-based forms, compact date/guest selector, enhanced pricing summary, smooth transitions
 */

"use client";

import React, { useEffect, useState, useRef, memo } from 'react';
import { BookingProvider } from '../contexts';
import { DateAndGuestSelector, PricingSummary, MobilePriceDrawer, MobileDateSelectorWrapper, TalkActions, OtaAlternatives } from '../components';
import type { OtaLink } from '../components';
import { ContactFormV2, HoldFormV2, BookingFormV2 } from '../forms';
import type { Property, CurrencyCode } from '@/types';
import { loggers } from '@/lib/logger';
import { ArrowLeft, Calendar, CalendarX2, ChevronDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { CurrencySwitcherSimple } from '@/components/currency-switcher-simple';
import { LanguageSelector } from '@/components/language-selector';
import { trackBeginCheckout, trackGenerateLead, trackUiEvent } from '@/lib/tracking';
import { getAttributionFromCookies } from '@/lib/utm';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { useBooking } from '../contexts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { RenderTracker } from '@/components/debug/RenderTracker';

// Memoized components for dynamic booking summary (copied from DateAndGuestSelector)
const BookingSummaryText = memo(function BookingSummaryText({ 
  nights, 
  guests,
  t 
}: { 
  nights: number; 
  guests: number;
  t: (key: string, fallback: string, options?: any) => string;
}) {
  return (
    <h3 className="text-lg font-semibold">
      {t('booking.bookingSummary', "You're booking a {{nights}}-night stay for {{guests}} {{guestLabel}}", {
        nights,
        guests,
        guestLabel: guests === 1 ? t('booking.guest', 'guest') : t('booking.guests', 'guests')
      })}
    </h3>
  );
});

const DateRangeDisplay = memo(function DateRangeDisplay({ 
  checkInDate, 
  checkOutDate,
  t,
  currentLang 
}: { 
  checkInDate: Date | null; 
  checkOutDate: Date | null; 
  t: (key: string, fallback: string, options?: any) => string;
  currentLang: string;
}) {
  if (!checkInDate || !checkOutDate) return null;
  
  const locale = currentLang === 'ro' ? ro : undefined;
  
  return (
    <p className="text-sm text-muted-foreground">
      {t('booking.arrivingLeaving', 'Arriving {{arrivalDate}} and leaving {{departureDate}}', {
        arrivalDate: format(checkInDate, "EEEE, MMMM d", { locale }),
        departureDate: format(checkOutDate, "EEEE, MMMM d", { locale })
      })}
    </p>
  );
});

interface BookingPageV2Props {
  property: Property;
  initialCurrency?: CurrencyCode;
  initialLanguage?: string;
  themeId?: string;
  className?: string;
  /** The property's own OTA listings, resolved server-side from the `channels` collection. */
  otaLinks?: OtaLink[];
}

// Internal component that uses the booking context
function BookingPageContent({ className, otaLinks = [] }: { className?: string; otaLinks?: OtaLink[] }) {
  const {
    property,
    checkInDate,
    checkOutDate,
    guestCount,
    pricing,
    isLoadingPricing,
    pricingError,
    selectedAction,
    setSelectedAction
  } = useBooking();
  
  const { formatPrice, convertToSelectedCurrency, selectedCurrency, setDefaultCurrency } = useCurrency();
  const { t, currentLang } = useLanguage();

  // Apply the property's default currency, exactly as a property page does (property-page-renderer).
  // The booking route never did this, so landing DIRECTLY on a booking link — an ad, a shared link, a
  // bookmark — left the CurrencyContext at its initial 'USD' and a Romanian guest was quoted "US$401"
  // instead of "1,838 lei". setDefaultCurrency still honours an explicit user choice and the
  // timezone rule (Europe/Bucharest → RON, elsewhere → EUR), so this only fills in the missing default.
  useEffect(() => {
    if (property?.baseCurrency) {
      setDefaultCurrency(property.baseCurrency);
    }
  }, [property?.baseCurrency, setDefaultCurrency]);
  const [activeTab, setActiveTab] = useState<'book' | 'hold' | 'contact'>('book');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  // Check if we have valid booking data
  const hasValidDates = checkInDate && checkOutDate;
  const hasValidPricing = !!(pricing && pricing.totalPrice > 0);
  const canShowBookingOptions = !!(hasValidDates && hasValidPricing);

  // Has the pricing question actually been ANSWERED yet?
  //
  // `!isLoadingPricing` was standing in for this, and it is not the same thing. The provider resets
  // to `{pricing:null, error:null, loading:false}` on every date/guest change and only flips
  // `loading` after a 500ms debounce — so there is always a window, at least half a second wide and
  // wider on a slow connection, where nothing is loading and nothing is known. Everything keyed off
  // `!isLoadingPricing` read that window as "we asked, and the answer is no".
  //
  // Measured on the live page 19 Aug: changing the guest count from 3 to 5 put "Datele Nu Sunt
  // Disponibile" on screen in red for two full seconds before the price arrived. On the booking page.
  // A settled answer is a price OR an error, never the absence of both.
  const hasPricingAnswer = !!(pricing || pricingError);

  const propertyName = typeof property.name === 'string' ? property.name : property.name.en;
  
  // Calculate nights for display
  const numberOfNights = checkInDate && checkOutDate 
    ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Every paid click lands on this page, and until now GA4 saw nothing of it: not the arrival, not the
  // price quoted, not whether the dates were even bookable. `begin_checkout` sits inside the form's
  // onSubmit, which is the last step, so the entire middle of the funnel was dark. This fires once per
  // outcome, as soon as pricing resolves, carrying what the visitor was actually shown — the number
  // they either accepted or left over.
  const reportedOutcome = useRef<string | null>(null);
  useEffect(() => {
    if (!hasValidDates || isLoadingPricing || !hasPricingAnswer) return;
    // The provider signals a BUSINESS answer and a TECHNICAL failure through the same `pricingError`
    // field, distinguished only by shape: a business answer is a translation key
    // (`booking.datesUnavailable`, `booking.minimumStayRequiredFromDate:3`), a failure is a raw
    // message. Reporting both as 'error' would have hidden the two numbers actually worth acting on
    // — dates already taken (a calendar problem) and stays too short (a min-stay rule you set).
    const outcome = !pricingError
      ? hasValidPricing ? 'priced' : 'unavailable'
      : pricingError.startsWith('booking.minimumStay') ? 'minimum_stay'
      : pricingError.startsWith('booking.') ? 'unavailable'
      : 'error';
    if (reportedOutcome.current === outcome) return;
    reportedOutcome.current = outcome;
    trackUiEvent('booking_page_view', {
      booking_outcome: outcome,
      value: hasValidPricing ? pricing!.totalPrice : undefined,
      currency: hasValidPricing ? pricing!.currency : undefined,
      stay_dates: `${checkInDate!.toISOString().slice(0, 10)}_${checkOutDate!.toISOString().slice(0, 10)}`,
      stay_nights: numberOfNights,
      stay_guests: guestCount,
    });
  }, [hasValidDates, isLoadingPricing, hasPricingAnswer, pricingError, hasValidPricing, pricing, checkInDate, checkOutDate, numberOfNights, guestCount]);

  // WHICH form did they start, and did they finish it?
  //
  // The page tracked arriving (`booking_page_view`), picking a tab (`select_booking_action`) and
  // SUBMITTING (`begin_checkout` / `generate_lead`) — and nothing in between. So on 22 Aug, when one
  // visitor opened the contact form and never sent it, there was no way to tell whether they typed a
  // word or bounced off the first field. With 15 people reaching this page, 1 picking an action and
  // 0 submitting, "did they try and give up?" was exactly the unanswerable question.
  //
  // Fires on the first real input inside a form, once per form per page life. `onInputCapture` on the
  // wrapper catches any field without each form component having to know it is being measured.
  const formStarted = useRef<Record<string, boolean>>({});
  const reportFormStart = (which: 'book' | 'hold' | 'contact') => {
    if (formStarted.current[which]) return;
    formStarted.current[which] = true;
    trackUiEvent('form_start', {
      booking_action: which,
      value: hasValidPricing ? pricing!.totalPrice : undefined,
      currency: hasValidPricing ? pricing!.currency : undefined,
      stay_nights: numberOfNights,
      stay_guests: guestCount,
    });
  };

  // Handle tab click and set selected action
  const handleTabClick = (tab: 'book' | 'hold' | 'contact') => {
    setActiveTab(tab);
    setSelectedAction(tab);
    // Deliberately NOT fired by the auto-select effect below: that one picks 'book' on the visitor's
    // behalf, and counting it as a choice would drown out the real signal. `contact` in particular is
    // a visitor saying they want to talk rather than transact, which is worth knowing.
    trackUiEvent('select_booking_action', {
      booking_action: tab,
      value: hasValidPricing ? pricing!.totalPrice : undefined,
      stay_nights: numberOfNights,
      stay_guests: guestCount,
    });
  };

  // Auto-select Book Now when pricing becomes available
  useEffect(() => {
    if (canShowBookingOptions && !selectedAction) {
      setSelectedAction('book');
      setActiveTab('book');
    }
  }, [canShowBookingOptions, selectedAction, setSelectedAction]);

  return (
    <div className="min-h-screen bg-background">
      {/* 🔍 DIAGNOSTIC COMPONENT - Track re-renders */}
      <RenderTracker name="BookingPageV2-Content" data={{ currentLang, propertyName }} />
      {/* Mobile Header - Arrow + Property + Currency/Language */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border md:hidden">
        <div className="container px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Arrow + Property Name */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link 
                href={`/properties/${property.slug}`}
                className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 flex-shrink-0" />
                <span className="text-sm font-medium truncate text-foreground">{propertyName}</span>
              </Link>
            </div>
            
            {/* Right: Currency + Language Selectors */}
            <div className="flex items-center gap-1 ml-2">
              <CurrencySwitcherSimple variant="booking" />
              <LanguageSelector variant="booking" />
            </div>
          </div>
        </div>
      </div>


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

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-32 lg:pb-8 ${className}`}>
        {/* V2.7 Reorganized Layout: Control Panel (Left) + Workspace (Right) */}
      <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Left Column: 40% - Control Panel (Date/Guest + Price + Actions) */}
        <div className="lg:col-span-2">
          {/* Date & Guest Selection */}
          <MobileDateSelectorWrapper />
          
          {/* Mobile: Pricing will be shown in sticky bottom bar */}

          {/* Desktop: Control Panel - Sticky */}
          <div className="hidden lg:block lg:sticky lg:top-4 mt-6">
            {hasValidPricing && pricing ? (
              <Card className="overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  {/* Booking Summary Text - Using original dynamic components */}
                  <div className="text-center pb-3 border-b">
                    <BookingSummaryText nights={numberOfNights} guests={guestCount} t={t} />
                    <div className="mt-1">
                      <DateRangeDisplay checkInDate={checkInDate} checkOutDate={checkOutDate} t={t} currentLang={currentLang} />
                    </div>
                  </div>
                  
                  {/* Total Price Display */}
                  <div className="text-center py-2">
                    <div className="text-3xl font-bold text-foreground">
                      {formatPrice(convertToSelectedCurrency(pricing.totalPrice || pricing.total, pricing.currency))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('booking.totalIncludesFees', 'Total (includes all fees)')}
                    </p>
                  </div>

                  {/* Price Breakdown - Per-night detail */}
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/50">
                      <span>{t('booking.viewPriceBreakdown', 'View price breakdown')}</span>
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 space-y-2 px-2">
                      {/* Per-night rates */}
                      {pricing.dailyRates && Object.keys(pricing.dailyRates).length > 0 ? (
                        Object.entries(pricing.dailyRates)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([dateStr, rate]) => (
                            <div key={dateStr} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {format(parseISO(dateStr), 'EEE, MMM d', { locale: currentLang === 'ro' ? ro : undefined })}
                              </span>
                              <span>{formatPrice(convertToSelectedCurrency(rate, pricing.currency))}</span>
                            </div>
                          ))
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span>{t('booking.basePrice', `Base price (${numberOfNights} ${numberOfNights === 1 ? 'night' : 'nights'})`)}</span>
                          <span>{formatPrice(convertToSelectedCurrency(pricing.accommodationTotal || pricing.basePrice || pricing.baseRate || 0, pricing.currency))}</span>
                        </div>
                      )}
                      {pricing.cleaningFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>{t('booking.cleaningFee', 'Cleaning fee')}</span>
                          <span>{formatPrice(convertToSelectedCurrency(pricing.cleaningFee, pricing.currency))}</span>
                        </div>
                      )}
                      {pricing.extraGuestFeeTotal && pricing.extraGuestFeeTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>{t('booking.extraGuestFee', 'Extra guest fee')}</span>
                          <span>{formatPrice(convertToSelectedCurrency(pricing.extraGuestFeeTotal, pricing.currency))}</span>
                        </div>
                      )}
                      {pricing.taxes && pricing.taxes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>{t('booking.taxes', 'Taxes')}</span>
                          <span>{formatPrice(convertToSelectedCurrency(pricing.taxes, pricing.currency))}</span>
                        </div>
                      )}
                      <div className="border-t pt-3">
                        <div className="flex justify-between font-semibold">
                          <span>{t('booking.total', 'Total')}</span>
                          <span>{formatPrice(convertToSelectedCurrency(pricing.totalPrice || pricing.total, pricing.currency))}</span>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Action Buttons - Control Panel */}
                  <div className="pt-3 border-t space-y-3">
                    <button
                      type="button"
                      onClick={() => handleTabClick('book')}
                      className={`w-full px-4 py-3 rounded-md font-medium text-sm transition-all duration-200 ${
                        (selectedAction === 'book' || (!selectedAction && activeTab === 'book'))
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      }`}
                    >
                      {t('booking.bookNow', 'Book Now')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabClick('hold')}
                      className={`w-full px-4 py-3 rounded-md font-medium text-sm transition-all duration-200 ${
                        selectedAction === 'hold'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      }`}
                    >
                      {t('booking.holdDates', 'Hold Dates')}
                    </button>
                    {/* The talk path replaces the old "Contact Host" button rather than joining it.
                        That button opened a four-field form before anyone could say a word, which is
                        the friction, not the cure — and a panel of five equal buttons reads as five
                        equal choices. The form is still here, one text link down. */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t('booking.haveAQuestion', 'Have a question?')}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <TalkActions position="summary_panel" />
                    <button
                      type="button"
                      onClick={() => handleTabClick('contact')}
                      className="w-full text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                    >
                      {t('booking.orSendAMessage', 'or send a message')}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ) : hasValidDates && pricingError ? (
              // Same reasoning as the larger unavailable card in the content column: a date that is
              // already booked is information, not an error the visitor caused. The suggestions sit
              // directly above this in the selector, so a red block here framed them as part of a
              // failure. (The form-submission error further down IS a real error and stays red.)
              <Card>
                <CardContent className="py-8 text-center">
                  <CalendarX2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-sm text-foreground font-medium">
                    {t('booking.datesNotAvailable', "These dates aren't available")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {t('booking.selectDatesToSeePricing', 'Select your dates to see pricing')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column: 60% - Dedicated Form Workspace */}
        <div className="lg:col-span-3">
          {/* Success/Error Messages */}
          {formStatus.show && (
            <div className={`mb-6 p-4 rounded-lg border ${
              formStatus.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{formStatus.message}</p>
                <button 
                  onClick={() => setFormStatus({ show: false, type: 'success', message: '' })}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          
          {selectedAction && pricing && (
            <div className="space-y-6">
              {/* Form Content */}
              {selectedAction === 'contact' && (
                <div onInputCapture={() => reportFormStart('contact')}>
                <ContactFormV2
                  onSubmit={async (values, pricingDetails, selectedCurrency) => {
                    setIsSubmitting(true);
                    setFormStatus({ show: false, type: 'success', message: '' });
                    loggers.bookingContext.debug('[V2] Contact form submission started', { values });
                    
                    try {
                      const { createInquiryAction } = await import('@/app/actions/createInquiryAction');
                      const attribution = getAttributionFromCookies();

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
                        currency: selectedCurrency as any,
                        language: currentLang as 'en' | 'ro',
                        attribution
                      });
                      
                      if (result.error) {
                        loggers.bookingContext.error('[V2] Contact form submission failed', { error: result.error });
                        setFormStatus({
                          show: true,
                          type: 'error',
                          message: t('booking.inquiryError', 'Failed to send inquiry. Please try again.')
                        });
                      } else {
                        loggers.bookingContext.info('[V2] Contact form submitted successfully', { inquiryId: result.inquiryId });
                        trackGenerateLead(property, pricingDetails?.totalPrice);
                        setFormStatus({
                          show: true,
                          type: 'success',
                          message: t('booking.inquirySuccess', 'Your inquiry has been sent successfully! We will respond within 24-48 hours.')
                        });
                        // Optionally clear the form or reset selected action
                        // setSelectedAction(null);
                      }
                    } catch (error) {
                      loggers.bookingContext.error('[V2] Contact form submission error', { error });
                      setFormStatus({
                        show: true,
                        type: 'error',
                        message: t('booking.unexpectedError', 'An unexpected error occurred. Please try again.')
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  isProcessing={isSubmitting}
                  isPending={isSubmitting}
                  pricingDetails={pricing}
                  selectedCurrency={selectedCurrency}
                />
                </div>
              )}

              {selectedAction === 'hold' && (
                <div onInputCapture={() => reportFormStart('hold')}>
                <HoldFormV2
                  onSubmit={async (values, _pricingDetails, selectedCurrency) => {
                    setIsSubmitting(true);
                    setFormStatus({ show: false, type: 'success', message: '' });
                    loggers.bookingContext.debug('[V2] Hold form submission started', { values });

                    try {
                      const { createHoldBookingAction } = await import('@/app/actions/createHoldBookingAction');
                      const attribution = getAttributionFromCookies();

                      trackBeginCheckout(property, {
                        total: property.holdFeeAmount || 50,
                        currency: selectedCurrency,
                        baseRate: property.holdFeeAmount || 50,
                        numberOfNights: 0,
                      }, {
                        checkIn: checkInDate!.toISOString(),
                        checkOut: checkOutDate!.toISOString(),
                      }, guestCount, 'hold');

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
                        holdDurationHours: property.holdDurationHours || 24,
                        holdFeeRefundable: property.holdFeeRefundable ?? true,
                        selectedCurrency,
                        language: currentLang as 'en' | 'ro',
                        attribution
                      });

                      if (holdResult.error || !holdResult.bookingId) {
                        loggers.bookingContext.error('[V2] Hold booking creation failed', { error: holdResult.error });
                        setFormStatus({
                          show: true,
                          type: 'error',
                          message: t('booking.holdError', 'Failed to create hold. Please try again.')
                        });
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
                        setFormStatus({
                          show: true,
                          type: 'error',
                          message: t('booking.holdCheckoutError', 'Failed to create payment session. Please try again.')
                        });
                        return;
                      }

                      loggers.bookingContext.info('[V2] Redirecting to Stripe for hold payment', { sessionId: checkoutResult.sessionId });
                      window.location.href = checkoutResult.sessionUrl;
                    } catch (error) {
                      loggers.bookingContext.error('[V2] Hold form submission error', { error });
                      setFormStatus({
                        show: true,
                        type: 'error',
                        message: t('booking.unexpectedError', 'An unexpected error occurred. Please try again.')
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  isProcessing={isSubmitting}
                  isPending={isSubmitting}
                  pricingDetails={pricing}
                  selectedCurrency={selectedCurrency}
                />
                </div>
              )}

              {selectedAction === 'book' && (
                <div onInputCapture={() => reportFormStart('book')}>
                <BookingFormV2
                  onSubmit={async (values, pricingDetails, appliedCoupon, selectedCurrency) => {
                    setIsSubmitting(true);
                    setFormStatus({ show: false, type: 'success', message: '' });
                    loggers.bookingContext.debug('[V2] Booking form submission started', { values });

                    try {
                      const { createPendingBookingAction } = await import('@/app/actions/booking-actions');
                      const attribution = getAttributionFromCookies();

                      trackBeginCheckout(property, {
                        total: pricingDetails!.totalPrice || pricingDetails!.total || 0,
                        currency: selectedCurrency,
                        baseRate: pricingDetails!.baseRate || pricingDetails!.basePrice || 0,
                        numberOfNights: pricingDetails!.numberOfNights,
                      }, {
                        checkIn: checkInDate!.toISOString(),
                        checkOut: checkOutDate!.toISOString(),
                      }, guestCount, 'book');

                      // Convert all pricing values from property's base currency to selected currency
                      const baseCurrency = pricingDetails!.currency;
                      const convertPrice = (price: number | undefined) =>
                        price ? convertToSelectedCurrency(price, baseCurrency) : 0;

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
                          // Calculate baseRate from accommodationTotal / nights (pricing API doesn't return baseRate directly)
                          baseRate: convertPrice(
                            pricingDetails!.baseRate ||
                            pricingDetails!.basePrice ||
                            (pricingDetails!.accommodationTotal && pricingDetails!.numberOfNights
                              ? pricingDetails!.accommodationTotal / pricingDetails!.numberOfNights
                              : 0)
                          ),
                          numberOfNights: pricingDetails!.numberOfNights,
                          cleaningFee: convertPrice(pricingDetails!.cleaningFee),
                          extraGuestFee: convertPrice(pricingDetails!.extraGuestFee || pricingDetails!.extraGuestFeeTotal),
                          numberOfExtraGuests: pricingDetails!.numberOfExtraGuests,
                          accommodationTotal: convertPrice(pricingDetails!.accommodationTotal || pricingDetails!.subtotal),
                          subtotal: convertPrice(pricingDetails!.subtotal),
                          taxes: convertPrice(pricingDetails!.taxes),
                          discountAmount: convertPrice(pricingDetails!.discountAmount),
                          total: convertPrice(pricingDetails!.totalPrice || pricingDetails!.total),
                          currency: selectedCurrency as any
                        },
                        status: 'pending',
                        appliedCouponCode: appliedCoupon?.code || null,
                        language: currentLang as 'en' | 'ro',
                        attribution
                      });

                      if (bookingResult.error || !bookingResult.bookingId) {
                        loggers.bookingContext.error('[V2] Pending booking creation failed', { error: bookingResult.error });
                        setFormStatus({
                          show: true,
                          type: 'error',
                          message: t('booking.bookingError', 'Failed to create booking. Please try again.')
                        });
                        return;
                      }

                      const { createCheckoutSession } = await import('@/app/actions/create-checkout-session');

                      // Convert price to selected currency (pricing API returns in property's base currency)
                      const totalInSelectedCurrency = convertToSelectedCurrency(
                        pricingDetails!.totalPrice || pricingDetails!.total || 0,
                        pricingDetails!.currency
                      );

                      const checkoutResult = await createCheckoutSession({
                        property,
                        checkInDate: checkInDate!.toISOString(),
                        checkOutDate: checkOutDate!.toISOString(),
                        numberOfGuests: guestCount,
                        totalPrice: totalInSelectedCurrency,
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
                        setFormStatus({
                          show: true,
                          type: 'error',
                          message: t('booking.checkoutError', 'Failed to create payment session. Please try again.')
                        });
                        return;
                      }

                      loggers.bookingContext.info('[V2] Redirecting to Stripe for booking payment', { sessionId: checkoutResult.sessionId });
                      window.location.href = checkoutResult.sessionUrl;
                    } catch (error) {
                      loggers.bookingContext.error('[V2] Booking form submission error', { error });
                      setFormStatus({
                        show: true,
                        type: 'error',
                        message: t('booking.unexpectedError', 'An unexpected error occurred. Please try again.')
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  isProcessing={isSubmitting}
                  isPending={isSubmitting}
                  pricingDetails={pricing}
                  selectedCurrency={selectedCurrency}
                />
                </div>
              )}
            </div>
          )}

          {/* Empty state for right column when no action selected */}
          {!selectedAction && canShowBookingOptions && (
            <div className="flex items-start justify-center lg:min-h-96 lg:items-center">
              <Card className="w-full max-w-md">
                <CardContent className="py-12 text-center">
                  <div className="mb-4">
                    <Calendar className="h-16 w-16 mx-auto text-muted-foreground/30" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {t('booking.readyToBook', 'Ready to Book?')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('booking.selectActionInControlPanel', 'Select an action from the control panel on the left to continue')}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loading state - dates selected, checking pricing. Also covers the debounce window before
              the request starts, which otherwise fell through to the "unavailable" card below. */}
          {!canShowBookingOptions && hasValidDates && (isLoadingPricing || !hasPricingAnswer) && (
            <div className="flex items-start justify-center lg:min-h-96 lg:items-center">
              <Card className="w-full max-w-md">
                <CardContent className="py-12 text-center">
                  <div className="mb-4">
                    <Loader2 className="h-16 w-16 mx-auto text-muted-foreground/30 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {t('booking.checkingAvailability', 'Checking Availability...')}
                  </h3>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Unavailable state - dates selected, asked, and the answer really was no. */}
          {!canShowBookingOptions && hasValidDates && !isLoadingPricing && hasPricingAnswer && (
            /* `hidden lg:flex`, not just hidden CONTENTS. Both halves of this card are desktop-only
               — the heading because the selector already says it, the talk buttons because they
               moved to the sticky bar — which left a 65px empty bordered box sitting on the phone.
               Caught by rendering the page in a 390px iframe; the stylesheet could not show it. */
            <div className="hidden lg:flex lg:min-h-96 lg:items-center lg:justify-center">
              {/* 29-37% of everyone who reaches this page lands here, which makes it the busiest
                  state on the page after "priced". It used to be styled entirely in the error
                  palette — red icon, red heading, red border — which reads as "stop" at the exact
                  moment the visitor needs to be handed the next step. The news is now one quiet
                  line, and the two ways forward (the suggestions to the left, a person on
                  WhatsApp) carry the weight instead.

                  Deliberately NO OTA links here: the calendar is iCal-synced, so a date taken
                  direct is taken on Airbnb and Booking too — offering them would be a second
                  closed door. */}
              <Card className="w-full max-w-md">
                <CardContent className="py-8 text-center lg:py-10">
                  {/* DESKTOP ONLY. On desktop this column would otherwise be empty while the
                      selector on the left carries the message and the suggestions — so it restates
                      the situation to fill it. On mobile the two stack, and restating it turns into
                      the same sentence twice with a large empty icon between the suggestions and the
                      way out. Reported from a real iPhone, 27 Aug. */}
                  <div>
                    <div className="mb-4">
                      <CalendarX2 className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {t('booking.datesUnavailableTitle', 'These Dates Are Unavailable')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('booking.datesUnavailableHint', 'Try one of the suggested dates, or pick different ones.')}
                    </p>
                  </div>
                  {/* Desktop only. On a phone these two live in the sticky bar at the bottom of the
                      screen instead — stranded mid-page they were a scroll away from the person who
                      needed them, which is the opposite of the point. */}
                  <div className="mt-6 border-t border-border pt-5">
                    <p className="mb-3 text-sm text-muted-foreground">
                      {t('booking.askWhatIsFree', "Or ask me — I'll tell you what's free.")}
                    </p>
                    <TalkActions position="unavailable_dates" variant="unavailable" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* No dates selected state */}
          {!canShowBookingOptions && !hasValidDates && (
            <div className="flex items-start justify-center lg:min-h-96 lg:items-center">
              <Card className="w-full max-w-md">
                <CardContent className="py-12 text-center">
                  <div className="mb-4">
                    <Calendar className="h-16 w-16 mx-auto text-muted-foreground/30" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {t('booking.selectDates', 'Select Your Dates')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('booking.selectDatesMessage', 'Choose your check-in and check-out dates in the control panel to view pricing and booking options')}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Last thing on the page, by design. Placed beside the price it would invite a comparison
              we don't control; placed here it reads as reassurance to someone who was leaving
              anyway. Text links, never buttons — see OtaAlternatives for why the economics make
              this worth offering at all. */}
          <OtaAlternatives links={otaLinks} className="mt-8 lg:mt-10" />
        </div>
      </div>
      </div>

      {/* No price means no sticky bar at all, which left the phone with nothing pinned and the only
          way forward buried mid-scroll. If we cannot offer a price we can still offer a person. */}
      {!(hasValidPricing && pricing) && hasValidDates && !isLoadingPricing && hasPricingAnswer && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] backdrop-blur lg:hidden">
          <div className="container px-4 py-3">
            <p className="mb-2 text-center text-xs text-muted-foreground">
              {t('booking.askWhatIsFree', "Or ask me — I'll tell you what's free.")}
            </p>
            <TalkActions position="unavailable_dates" variant="unavailable" />
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Bar - Professional Design */}
      {hasValidPricing && pricing && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:hidden">
          <div className="container px-4 py-3">
            {/* Compact Price Header with Details Link */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl font-bold text-foreground whitespace-nowrap">
                  {formatPrice(convertToSelectedCurrency(pricing.totalPrice || pricing.total, pricing.currency))}
                </span>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {numberOfNights} {numberOfNights === 1 ? t('common.night', 'night') : t('common.nights', 'nights')}
                </span>
              </div>
              <MobilePriceDrawer
                property={property}
                pricing={pricing}
                checkInDate={checkInDate!}
                checkOutDate={checkOutDate!}
                guestCount={guestCount}
                nights={numberOfNights}
              />
            </div>
            
            {/* Action Buttons - Clean Segmented Design */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTabClick('book')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                  selectedAction === 'book' || (!selectedAction && activeTab === 'book')
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {t('booking.bookNow', 'Book Now')}
              </button>
              <button
                type="button"
                onClick={() => handleTabClick('hold')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                  selectedAction === 'hold'
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {t('booking.holdDates', 'Hold Dates')}
              </button>
              {/* 87% of this page's traffic is mobile and this bar is thumb territory, so the
                  primary CTA has to stay dominant: WhatsApp goes in as a 44px icon beside it, not a
                  third equal-width button. The contact FORM is reachable from the link under the
                  form area — it does not need a permanent slot in the sticky bar. */}
              <TalkActions position="mobile_bar" compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main component that provides the booking context
export function BookingPageV2({ 
  property, 
  initialCurrency, 
  initialLanguage,
  themeId,
  className,
  otaLinks
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
      <BookingPageContent className={className} otaLinks={otaLinks} />
    </BookingProvider>
  );
}