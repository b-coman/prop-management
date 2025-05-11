"use client";

import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { Loader2, Calendar, Check, X, ArrowRight, Mail, Phone as PhoneIcon, Send } from 'lucide-react';
import { format, startOfDay, differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/contexts/BookingContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { calculatePrice } from '@/lib/price-utils';
import { Button } from '@/components/ui/button';
import { BookingOptionsCards } from '../booking-options-cards';
import { BookingSummary } from '../booking-summary';
import { BookingForm } from '../forms/BookingForm';
import { HoldForm } from '../forms/HoldForm';
import { ContactHostForm } from '../forms/ContactHostForm';
import { createInquiryAction } from '@/app/actions/createInquiryAction';
import { createHoldBookingAction } from '@/app/actions/createHoldBookingAction';
import { createHoldCheckoutSession } from '@/app/actions/createHoldCheckoutSession';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';

interface AvailabilityCheckContainerProps {
  property: any;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

// Enhanced version that safely handles availability checking
function AvailabilityCheckContainer({ property, initialCheckIn, initialCheckOut }: AvailabilityCheckContainerProps) {
  // Use ref to track renders
  const renderCountRef = useRef(0);
  const [hasMounted, setHasMounted] = useState(false);

  // Get values from booking context
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests,
    firstName,
    lastName,
    email,
    phone,
    message,
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setMessage,
  } = useBooking();

  // State for availability checking and booking options
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [wasChecked, setWasChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // State for booking functionality
  const [selectedOption, setSelectedOption] = useState<'contact' | 'hold' | 'bookNow' | null>(null);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<string | undefined>(undefined);
  const [canRetryError, setCanRetryError] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);

  // Import needed hooks
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, formatPrice } = useCurrency();

  // Calculate pricing details for the booking - using hooks in the proper order
  const propertyBaseCcy = useMemo(() => baseCurrencyForProperty(property.baseCurrency), [property.baseCurrency, baseCurrencyForProperty]);

  const pricingDetailsInBaseCurrency = useMemo(() => {
    if (checkInDate && checkOutDate && numberOfNights > 0 && property) {
      return calculatePrice(
        property.pricePerNight,
        numberOfNights,
        property.cleaningFee ?? 0,
        numberOfGuests,
        property.baseOccupancy || 1,
        property.extraGuestFee ?? 0,
        propertyBaseCcy,
        appliedCoupon?.discountPercentage
      );
    }
    return null;
  }, [
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests,
    property,
    appliedCoupon,
    propertyBaseCcy
  ]);


  // Set mounted flag on first render
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Log each render for debugging
  useEffect(() => {
    renderCountRef.current += 1;
    console.log(`[AvailabilityCheckContainer] Render #${renderCountRef.current} with property: ${property.slug}`);

    return () => {
      console.log(`[AvailabilityCheckContainer] Component will unmount`);
    };
  });

  // Real availability check using the getUnavailableDatesForProperty service
  const handleCheckAvailability = async () => {
    if (!checkInDate || !checkOutDate) return;

    setIsCheckingAvailability(true);

    try {
      // Import the service directly to avoid dependency injection issues
      const { getUnavailableDatesForProperty } = await import('@/services/availabilityService');

      console.log(`[AvailabilityCheckContainer] Checking availability for dates: ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}`);

      // Get unavailable dates from Firebase through the API
      const unavailableDates = await getUnavailableDatesForProperty(property.slug);
      console.log(`[AvailabilityCheckContainer] Received ${unavailableDates.length} unavailable dates`);

      // Check if any of the selected dates are unavailable
      let conflict = false;
      let current = new Date(checkInDate.getTime());

      // Check day by day
      while (current < checkOutDate) {
        const currentDateStr = format(startOfDay(current), 'yyyy-MM-dd');

        // Check if this date is in the unavailableDates array
        if (unavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === currentDateStr)) {
          console.log(`[AvailabilityCheckContainer] Conflict found on ${currentDateStr}`);
          conflict = true;
          break;
        }

        // Move to the next day
        current.setDate(current.getDate() + 1);
      }

      console.log(`[AvailabilityCheckContainer] Availability result: ${!conflict ? 'Available' : 'Not Available'}`);
      setIsAvailable(!conflict);
      setWasChecked(true);
    } catch (error) {
      console.error('[AvailabilityCheckContainer] Error checking availability:', error);
      // In case of error, assume not available for safety
      setIsAvailable(false);
      setWasChecked(true);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  if (!hasMounted) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading booking options...</p>
      </div>
    );
  }


  // Handle form submissions
  const onInquirySubmit = async (values: any) => {
    setFormError(null);
    if (!checkInDate || !checkOutDate) {
      setFormError("Please select valid check-in and check-out dates.");
      toast({
        title: "Missing Dates",
        description: "Please select check-in and check-out dates for your inquiry.",
        variant: "destructive"
      });
      return;
    }

    startTransition(async () => {
      const inquiryInput = {
        propertySlug: property.slug,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guestCount: numberOfGuests,
        guestInfo: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
        },
        message: values.message,
        // Convert the price to the selected currency
        totalPrice: pricingDetailsInBaseCurrency
          ? convertToSelectedCurrency(pricingDetailsInBaseCurrency.total, pricingDetailsInBaseCurrency.currency)
          : undefined,
        currency: selectedCurrency,
      };

      const result = await createInquiryAction(inquiryInput);
      if (result.error) {
        setFormError(result.error);
        toast({ title: "Inquiry Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Inquiry Sent!", description: "Your message has been sent to the host." });
        // Just close the form without resetting values
        setSelectedOption(null);
      }
    });
  };

  const handleHoldDates = async (selectedCurrency: string, formData?: any) => {
    setFormError(null);

    // Client-side validation
    if (!checkInDate || !checkOutDate || !property.holdFeeAmount) {
      setFormError("Please select valid dates. Hold fee must be configured for this property.");
      toast({
        title: "Missing Information",
        description: "Please select valid dates. This property requires a hold fee.",
        variant: "destructive",
      });
      return;
    }

    if (!firstName || !lastName || !email) { // Phone is optional for hold
      setFormError("Please fill in First Name, Last Name, and Email to hold dates.");
      toast({
        title: "Missing Information",
        description: "Please provide your name and email to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingBooking(true);

    try {
      // Use the form data directly if provided, otherwise use context values
      const guestInfo = formData || {
        firstName,
        lastName,
        email,
        phone
      };

      // Prepare hold booking input
      const holdBookingInput = {
        propertySlug: property.slug,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guestCount: numberOfGuests,
        guestInfo,
        holdFeeAmount: property.holdFeeAmount,
        selectedCurrency: selectedCurrency,
      };

      // Create hold booking in database
      const holdBookingResult = await createHoldBookingAction(holdBookingInput);

      // Handle errors from hold booking creation
      if (holdBookingResult.error || !holdBookingResult.bookingId) {
        const errorMsg = holdBookingResult.error || "Could not create hold booking";

        toast({
          title: "Hold Booking Error",
          description: errorMsg,
          variant: "destructive",
        });

        setFormError(errorMsg);
        return;
      }

      const { bookingId: holdBookingId } = holdBookingResult;

      // Set up hold checkout session for payment
      const holdCheckoutInput = {
        property: property,
        holdBookingId: holdBookingId,
        holdFeeAmount: property.holdFeeAmount,
        guestEmail: email,
        selectedCurrency: selectedCurrency as any,
      };

      // Create checkout session
      const stripeHoldResult = await createHoldCheckoutSession(holdCheckoutInput);

      // Handle errors from checkout session creation
      if (stripeHoldResult.error || !stripeHoldResult.sessionUrl) {
        const errorMsg = stripeHoldResult.error || "Payment processing error";

        toast({
          title: "Payment Error",
          description: errorMsg,
          variant: "destructive",
        });

        setFormError(errorMsg);
        return;
      }

      // Redirect to Stripe checkout
      router.push(stripeHoldResult.sessionUrl);

    } catch (error) {
      // Handle unexpected errors
      console.error("Error processing hold dates:", error);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong while trying to hold these dates. Please try again.";

      setFormError(errorMessage);
      toast({
        title: "Hold Dates Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000 // Longer duration for unexpected errors
      });
    } finally {
      setIsProcessingBooking(false);
    }
  };

  const handleContinueToPayment = async () => {
    setFormError(null);

    // Client-side validation
    if (!checkInDate || !checkOutDate || !pricingDetailsInBaseCurrency) {
      setFormError("Please select valid dates and ensure price is calculated.");
      toast({
        title: "Missing Information",
        description: "Please select valid dates for your booking.",
        variant: "destructive",
      });
      return;
    }

    if (!firstName || !lastName || !email || !phone) {
      setFormError("Please fill in all required guest information.");
      toast({
        title: "Missing Information",
        description: "Please provide all required guest details.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingBooking(true);

    try {
      // Create the booking input with default values to avoid undefined
      const bookingInput = {
        propertyId: property.slug,
        guestInfo: {
          firstName,
          lastName,
          email,
          phone
        },
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests,
        pricing: {
          // Map fields with safe defaults
          baseRate: pricingDetailsInBaseCurrency.basePrice || 0,
          accommodationTotal: (pricingDetailsInBaseCurrency.basePrice || 0) + (pricingDetailsInBaseCurrency.extraGuestFeeTotal || 0),
          cleaningFee: pricingDetailsInBaseCurrency.cleaningFee || 0,
          // These two are optional in the schema, but set them to 0 to avoid undefined
          extraGuestFee: pricingDetailsInBaseCurrency.extraGuestFeeTotal || 0,
          numberOfExtraGuests: pricingDetailsInBaseCurrency.numberOfExtraGuests || 0,
          // Required fields with safe defaults
          subtotal: pricingDetailsInBaseCurrency.subtotal || 0,
          discountAmount: pricingDetailsInBaseCurrency.discountAmount || 0,
          total: pricingDetailsInBaseCurrency.total || 0,
          currency: selectedCurrency as any,
          numberOfNights: pricingDetailsInBaseCurrency.numberOfNights || 0,
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCoupon?.code ?? null,
      };

      // Create pending booking in database
      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      // Handle errors from booking creation
      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        const errorMsg = pendingBookingResult.error || "Could not create booking";
        const canRetry = pendingBookingResult.retry === true;

        toast({
          title: canRetry ? "Please Try Again" : "Booking Error",
          description: errorMsg,
          variant: "destructive",
          // For network errors, make toast stay longer to give user time to read it
          duration: pendingBookingResult.errorType === 'network_error' ? 8000 : 5000,
        });

        setFormError(errorMsg);
        setLastErrorType(pendingBookingResult.errorType);
        setCanRetryError(canRetry);
        return;
      }

      const { bookingId } = pendingBookingResult;

      // Create checkout session to process payment
      const checkoutInput = {
        property: property,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: numberOfGuests,
        totalPrice: bookingInput.pricing.total,
        numberOfNights: numberOfNights,
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: email,
        pendingBookingId: bookingId,
        selectedCurrency: selectedCurrency as any,
      };

      const stripeResult = await createCheckoutSession(checkoutInput);

      // Handle errors from Stripe checkout creation
      if (stripeResult.error || !stripeResult.sessionUrl) {
        const errorMsg = stripeResult.error || "Payment processing error";
        const canRetry = stripeResult.retry === true;

        toast({
          title: canRetry ? "Payment Processing Issue" : "Payment Error",
          description: errorMsg,
          variant: "destructive",
          duration: stripeResult.errorType === 'network_error' ? 8000 : 5000,
        });

        setFormError(errorMsg);
        setLastErrorType(pendingBookingResult.errorType);
        setCanRetryError(canRetry);
        return;
      }

      // Navigate to Stripe Checkout
      router.push(stripeResult.sessionUrl);

    } catch (error) {
      // Handle unexpected errors
      console.error("Error processing booking:", error);

      let errorMessage = "Something went wrong with your booking. Please try again.";

      // For known error types, provide more specific messages
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = "Network connection issue. Please check your internet connection and try again.";
        } else if (error.message.includes('Stripe') || error.message.includes('payment')) {
          errorMessage = "There was a problem processing your payment. Please try again.";
        } else if (error.message.includes('unavailable') || error.message.includes('service')) {
          errorMessage = "Service temporarily unavailable. Please try again in a few minutes.";
        } else {
          // Use the actual error message for other cases
          errorMessage = error.message;
        }
      }

      setFormError(errorMessage);

      toast({
        title: "Booking Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000, // Longer duration for unexpected errors
      });
    } finally {
      setIsProcessingBooking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
      <div className="p-4 border border-blue-200 bg-blue-50 rounded-md mb-6">
        <h3 className="font-medium text-blue-800">Availability Container</h3>
        <p className="text-sm text-blue-700 mb-4">
          Select your dates and check availability.
        </p>

        <div className="flex items-center space-x-2 bg-white p-3 rounded shadow-sm">
          <Calendar className="h-4 w-4 text-blue-600" />
          <p>Property: {property.name || property.slug}</p>
        </div>

        {(checkInDate && checkOutDate) && (
          <div className="mt-3 bg-white p-3 rounded shadow-sm">
            <p className="text-sm">
              <strong>Selected Dates:</strong> {format(checkInDate, 'MMM dd, yyyy')} to {format(checkOutDate, 'MMM dd, yyyy')}
              {numberOfNights > 0 && ` (${numberOfNights} nights)`}
            </p>
          </div>
        )}

        {wasChecked && isAvailable !== null && (
          <div className={`mt-3 ${isAvailable ? 'bg-green-100' : 'bg-red-100'} p-3 rounded shadow-sm flex items-center`}>
            {isAvailable ? (
              <>
                <Check className="h-4 w-4 text-green-600 mr-2" />
                <p className="text-sm text-green-800">These dates are available!</p>
              </>
            ) : (
              <>
                <X className="h-4 w-4 text-red-600 mr-2" />
                <p className="text-sm text-red-800">These dates are not available.</p>
              </>
            )}
          </div>
        )}

        {checkInDate && checkOutDate && (
          <div className="mt-4">
            <Button
              onClick={handleCheckAvailability}
              disabled={isCheckingAvailability || !checkInDate || !checkOutDate}
              className="w-full"
            >
              {isCheckingAvailability ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                wasChecked ? 'Re-check Availability' : 'Check Availability'
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Booking options and forms section - only show when dates are available */}
      {isAvailable === true && wasChecked && (
        <div className="mt-8 space-y-6">
          {/* Pricing summary */}
          <BookingSummary
            numberOfNights={numberOfNights}
            numberOfGuests={numberOfGuests}
            pricingDetails={pricingDetailsInBaseCurrency}
            propertyBaseCcy={propertyBaseCcy}
            appliedCoupon={appliedCoupon}
          />

          {/* Booking options */}
          <BookingOptionsCards
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            property={property}
          />

          {/* Contact host form */}
          {selectedOption === 'contact' && (
            <ContactHostForm
              onSubmit={onInquirySubmit}
              isProcessing={isProcessingBooking}
              isPending={isPending}
              pricingDetails={pricingDetailsInBaseCurrency}
              selectedCurrency={selectedCurrency}
            />
          )}

          {/* Hold form */}
          {selectedOption === 'hold' && (
            <HoldForm
              property={property}
              isProcessing={isProcessingBooking}
              isPending={isPending}
              formError={formError}
              pricingDetails={pricingDetailsInBaseCurrency}
              selectedCurrency={selectedCurrency}
              onSubmit={handleHoldDates}
            />
          )}

          {/* Book now form */}
          {selectedOption === 'bookNow' && (
            <BookingForm
              property={property}
              isProcessing={isProcessingBooking}
              isPending={isPending}
              formError={formError}
              lastErrorType={lastErrorType}
              canRetryError={canRetryError}
              pricingDetails={pricingDetailsInBaseCurrency}
              appliedCoupon={appliedCoupon}
              setAppliedCoupon={setAppliedCoupon}
              selectedCurrency={selectedCurrency}
              onSubmit={handleContinueToPayment}
            />
          )}
        </div>
      )}
    </div>
  );
}

export { AvailabilityCheckContainer };