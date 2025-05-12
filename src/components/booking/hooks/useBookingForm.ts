"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useBooking } from '@/contexts/BookingContext';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import type { Property, PriceCalculationResult } from '@/types';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';
import { createHoldBookingAction } from '@/app/actions/createHoldBookingAction';
import { createHoldCheckoutSession } from '@/app/actions/createHoldCheckoutSession';
import { createInquiryAction } from '@/app/actions/createInquiryAction';

export function useBookingForm(property: Property) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  // Get booking context values
  const {
    checkInDate,
    checkOutDate,
    numberOfGuests,
    numberOfNights,
    firstName,
    lastName,
    email,
    phone,
    message
  } = useBooking();
  
  // Form processing state
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<string | undefined>(undefined);
  const [canRetryError, setCanRetryError] = useState<boolean>(false);
  
  // Selected booking option
  type SelectedOption = 'contact' | 'hold' | 'bookNow' | null;
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(null);
  
  /**
   * Process booking payment
   */
  const handleContinueToPayment = async (
    pricingDetails: PriceCalculationResult,
    appliedCouponCode: string | null = null,
    selectedCurrency: string,
    e?: React.FormEvent
  ) => {
    if (e) e.preventDefault();
    setFormError(null);

    // Client-side validation
    if (!checkInDate || !checkOutDate || !pricingDetails) {
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
          firstName: sanitizeText(firstName),
          lastName: sanitizeText(lastName),
          email: sanitizeEmail(email),
          phone: sanitizePhone(phone)
        },
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: numberOfGuests,
        pricing: {
          // Map fields with safe defaults
          baseRate: pricingDetails.basePrice || 0,
          accommodationTotal: (pricingDetails.basePrice || 0) + (pricingDetails.extraGuestFeeTotal || 0),
          cleaningFee: pricingDetails.cleaningFee || 0,
          // These two are optional in the schema, but set them to 0 to avoid undefined
          extraGuestFee: pricingDetails.extraGuestFeeTotal || 0,
          numberOfExtraGuests: pricingDetails.numberOfExtraGuests || 0,
          // Required fields with safe defaults
          subtotal: pricingDetails.subtotal || 0,
          discountAmount: pricingDetails.discountAmount || 0,
          total: pricingDetails.total || 0,
          currency: selectedCurrency,
          numberOfNights: pricingDetails.numberOfNights || 0,
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCouponCode ?? null,
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
        appliedCouponCode: appliedCouponCode,
        discountPercentage: pricingDetails.discountPercentage,
        guestFirstName: sanitizeText(firstName),
        guestLastName: sanitizeText(lastName),
        guestEmail: sanitizeEmail(email),
        pendingBookingId: bookingId,
        selectedCurrency: selectedCurrency,
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

  /**
   * Hold dates functionality
   */
  const handleHoldDates = async (
    selectedCurrency: string,
    formData?: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    },
    e?: React.FormEvent
  ) => {
    if (e) e.preventDefault();
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

    // Use form data if provided, otherwise use context values
    const useFormData = !!formData;
    const currentFirstName = useFormData ? formData.firstName : firstName;
    const currentLastName = useFormData ? formData.lastName : lastName;
    const currentEmail = useFormData ? formData.email : email;
    const currentPhone = useFormData ? formData.phone : phone;

    // Log validation check
    console.log('🔍 [CLIENT] Validating hold form data:', {
      source: useFormData ? 'direct form data' : 'context',
      firstName: currentFirstName,
      lastName: currentLastName,
      email: currentEmail,
      phone: currentPhone
    });

    // Check form values, but be more lenient
    if (!currentFirstName?.trim() || !currentLastName?.trim() || !currentEmail?.trim() || !currentPhone?.trim()) {
      setFormError("Please fill in all required fields to hold dates.");
      toast({
        title: "Missing Information",
        description: "Please provide your name, email and phone number to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingBooking(true);

    try {
      // Prepare hold booking input
      const holdBookingInput = {
        propertySlug: property.slug,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guestCount: numberOfGuests,
        guestInfo: {
          firstName: sanitizeText(currentFirstName),
          lastName: sanitizeText(currentLastName),
          email: sanitizeEmail(currentEmail),
          phone: currentPhone ? sanitizePhone(currentPhone) : undefined,
        },
        holdFeeAmount: property.holdFeeAmount,
        selectedCurrency: selectedCurrency,
      };

      // Create hold booking in database
      const holdBookingResult = await createHoldBookingAction(holdBookingInput);

      // Handle errors from hold booking creation
      if (holdBookingResult.error || !holdBookingResult.bookingId) {
        const errorMsg = holdBookingResult.error || "Could not create hold booking";
        const canRetry = holdBookingResult.retry === true;

        toast({
          title: canRetry ? "Please Try Again" : "Hold Booking Error",
          description: errorMsg,
          variant: "destructive",
          duration: holdBookingResult.errorType === 'network_error' ? 8000 : 5000,
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
        guestEmail: sanitizeEmail(currentEmail), // Use the currentEmail which might be from formData
        selectedCurrency: selectedCurrency,
      };

      // Create checkout session
      const stripeHoldResult = await createHoldCheckoutSession(holdCheckoutInput);

      // Handle errors from checkout session creation
      if (stripeHoldResult.error || !stripeHoldResult.sessionUrl) {
        const errorMsg = stripeHoldResult.error || "Payment processing error";
        const canRetry = stripeHoldResult.retry === true;

        toast({
          title: canRetry ? "Payment Processing Issue" : "Payment Error",
          description: errorMsg,
          variant: "destructive",
          duration: stripeHoldResult.errorType === 'network_error' ? 8000 : 5000,
        });

        setFormError(errorMsg);
        return;
      }

      // Redirect to Stripe checkout
      router.push(stripeHoldResult.sessionUrl);

    } catch (error) {
      // Handle unexpected errors
      console.error("Error processing hold dates:", error);

      let errorMessage = "Something went wrong while trying to hold these dates. Please try again.";

      // Provide more specific messages for known error types
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = "Network connection issue. Please check your internet connection and try again.";
        } else if (error.message.includes('Stripe') || error.message.includes('payment')) {
          errorMessage = "There was a problem with the payment system. Please try again.";
        } else if (error.message.includes('unavailable') || error.message.includes('service')) {
          errorMessage = "Service temporarily unavailable. Please try again in a few minutes.";
        } else {
          // Use the actual error message for other cases
          errorMessage = error.message;
        }
      }

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

  /**
   * Send inquiry to host
   */
  const onInquirySubmit = async (
    values: { 
      firstName: string; 
      lastName: string; 
      email: string; 
      phone?: string; 
      message: string;
    }, 
    pricingDetails: PriceCalculationResult | null, 
    selectedCurrency: string
  ) => {
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
        totalPrice: pricingDetails
          ? pricingDetails.total
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
        // This avoids the controlled/uncontrolled component error
        setSelectedOption(null);
      }
    });
  };

  return {
    isPending,
    isProcessingBooking,
    formError,
    lastErrorType,
    canRetryError,
    selectedOption,
    setSelectedOption,
    handleContinueToPayment,
    handleHoldDates,
    onInquirySubmit,
    setFormError,
  };
}