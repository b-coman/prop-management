"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format, differenceInDays, addDays, parseISO, isValid, isBefore, startOfDay, isAfter, startOfMonth, subMonths } from 'date-fns';
import {
  Loader2,
  Calendar as CalendarIcon,
  Users,
  CheckCircle,
  XCircle,
  Info,
  Mail,
  Phone,
  TicketPercent,
  X,
  AlertTriangle,
  ArrowRight,
  MapPin,
  BedDouble,
  Bath,
  Home,
  Building,
  Wind,
  Minus,
  Plus,
} from 'lucide-react';

import type { Property, Coupon, Availability } from '@/types';
import { getUnavailableDatesForProperty } from '@/services/bookingService';
import { validateAndApplyCoupon } from '@/services/couponService';
import { createPendingBookingAction } from '@/app/actions/booking-actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvailabilityCalendar } from './availability-calendar';
import { calculatePrice } from '@/lib/price-utils';
import { useSessionStorage } from '@/hooks/use-session-storage';
import { Badge } from '@/components/ui/badge';


interface AvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string; // YYYY-MM-DD
  initialCheckOut?: string; // YYYY-MM-DD
}

// Function to parse date strings safely
const parseDateSafe = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? startOfDay(parsed) : null; // Use startOfDay for consistency
  } catch {
    return null;
  }
};

export function AvailabilityCheck({
  property,
  initialCheckIn,
  initialCheckOut,
}: AvailabilityCheckProps) {
  const router = useRouter();
  const { toast } = useToast();

  // --- State Management ---
  const [checkInDate, setCheckInDate] = useState<Date | null>(parseDateSafe(initialCheckIn));
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(parseDateSafe(initialCheckOut));
  const [numberOfGuests, setNumberOfGuests] = useSessionStorage<number>(`booking_${property.id}_guests`, property.baseOccupancy || 1); // Default to base occupancy or 1

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [suggestedDates, setSuggestedDates] = useState<Array<{ from: Date; to: Date; recommendation?: string }>>([]);

  const [firstName, setFirstName] = useSessionStorage<string>(`booking_${property.id}_firstName`, '');
  const [lastName, setLastName] = useSessionStorage<string>(`booking_${property.id}_lastName`, '');
  const [email, setEmail] = useSessionStorage<string>(`booking_${property.id}_email`, '');
  const [phone, setPhone] = useSessionStorage<string>(`booking_${property.id}_phone`, '');

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [notifyAvailability, setNotifyAvailability] = useState(false);
  const [notificationMethod, setNotificationMethod] = useState<'email' | 'sms'>('email');

  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Derived State ---
  const datesSelected = checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate) && isAfter(checkOutDate, checkInDate);
  const numberOfNights = useMemo(() => {
    if (datesSelected && checkInDate && checkOutDate) { // Added null checks
      return differenceInDays(checkOutDate, checkInDate);
    }
    return 0;
  }, [checkInDate, checkOutDate, datesSelected]);

  const pricingDetails = useMemo(() => {
    if (datesSelected && numberOfGuests > 0) {
      return calculatePrice(
        property.pricePerNight,
        numberOfNights,
        property.cleaningFee,
        numberOfGuests,
        property.baseOccupancy,
        property.extraGuestFee,
        appliedCoupon?.discountPercentage
      );
    }
    return null;
  }, [datesSelected, property, numberOfNights, numberOfGuests, appliedCoupon]);

  // --- Availability Check Logic ---
  const checkPropertyAvailability = useCallback(async () => {
    if (!datesSelected || !checkInDate || !checkOutDate) { // Added null checks for dates
      setIsAvailable(null);
      setIsLoadingAvailability(false);
      setSuggestedDates([]);
      return;
    }

    setIsLoadingAvailability(true);
    setIsAvailable(null);
    setSuggestedDates([]);

    try {
      console.log(`[AvailabilityCheck] Fetching unavailable dates for property ${property.id}`);
      const fetchedUnavailableDates = await getUnavailableDatesForProperty(property.id);
      console.log(`[AvailabilityCheck] Fetched ${fetchedUnavailableDates.length} unavailable dates`);
      setUnavailableDates(fetchedUnavailableDates);

      let conflict = false;
      let current = new Date(checkInDate.getTime()); // Use guaranteed checkInDate
      while (isBefore(current, checkOutDate)) { // Use guaranteed checkOutDate
        const dateString = format(startOfDay(current), 'yyyy-MM-dd');
        if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
          console.log(`[AvailabilityCheck] Conflict found for date: ${dateString}`);
          conflict = true;
          break;
        }
        current = addDays(current, 1);
      }

      setIsAvailable(!conflict);
      console.log(`[AvailabilityCheck] Dates available: ${!conflict}`);

      if (conflict) {
        // Placeholder for suggesting alternative dates
        // TODO: Implement more robust suggestion logic, potentially using AI
        const suggested = [
          { from: addDays(checkOutDate!, 1), to: addDays(checkOutDate!, 1 + numberOfNights), recommendation: "Next Available" },
          { from: addDays(checkInDate!, 7), to: addDays(checkInDate!, 7 + numberOfNights) },
        ];
        const validSuggestions = suggested.filter(range => {
          let isValidSuggestion = true;
          let checkCurrent = new Date(range.from.getTime());
          while (isBefore(checkCurrent, range.to)) {
            const checkDateString = format(startOfDay(checkCurrent), 'yyyy-MM-dd');
            if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === checkDateString)) {
              isValidSuggestion = false;
              break;
            }
            checkCurrent = addDays(checkCurrent, 1);
          }
          // Ensure suggestion start date is not in the past
          return isValidSuggestion && !isBefore(startOfDay(range.from), startOfDay(new Date()));
        });
        console.log(`[AvailabilityCheck] Generated ${validSuggestions.length} valid suggested date ranges`);
        setSuggestedDates(validSuggestions.slice(0, 3));
      }

    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Error Checking Availability",
        description: "Could not check property availability. Please try again.",
        variant: "destructive",
      });
      setIsAvailable(false);
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [checkInDate, checkOutDate, datesSelected, property.id, numberOfNights, toast]);

  // Re-check availability when dates change
  useEffect(() => {
    checkPropertyAvailability();
  }, [checkPropertyAvailability]);

  // --- Guest Selection Logic ---
  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      const newCount = prev + change;
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };

  // --- Form Submission & Booking Logic ---

  const handleGuestInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'firstName') setFirstName(value);
    else if (name === 'lastName') setLastName(value);
    else if (name === 'email') setEmail(value);
    else if (name === 'phone') setPhone(value);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (!datesSelected || !checkInDate || !checkOutDate) { // Added null checks
      setCouponError('Please select valid booking dates first.');
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);
    setAppliedCoupon(null);

    try {
      const result = await validateAndApplyCoupon(couponCode.trim(), checkInDate, checkOutDate);
      if (result.error) {
        setCouponError(result.error);
      } else if (result.discountPercentage) {
        setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discountPercentage: result.discountPercentage });
        toast({
          title: "Coupon Applied!",
          description: `Successfully applied ${result.discountPercentage}% discount.`,
        });
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      setCouponError('Could not apply coupon. Please try again.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    toast({ title: "Coupon Removed" });
  };

  const handleSelectAlternativeDate = (range: { from: Date; to: Date }) => {
    setCheckInDate(range.from);
    setCheckOutDate(range.to);
     // Optionally scroll to top or to booking form after selection
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!datesSelected || isAvailable !== true || !checkInDate || !checkOutDate) { // Added null checks
      setFormError("Selected dates are not available or invalid.");
      return;
    }
    if (!firstName || !lastName || !email) {
      setFormError("Please fill in your first name, last name, and email.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!phone) {
      setFormError("Please enter your phone number.");
      return;
    }
    if (numberOfGuests < 1 || numberOfGuests > property.maxGuests) {
      setFormError(`Number of guests must be between 1 and ${property.maxGuests}.`);
      return;
    }
    if (!pricingDetails) {
      setFormError("Could not calculate pricing. Please try again.");
      return;
    }

    setIsProcessingBooking(true);

    try {
      console.log("[handleContinueToPayment] Creating pending booking...");
      const bookingInput = {
        propertyId: property.id,
        guestInfo: { firstName, lastName, email, phone },
        checkInDate: checkInDate.toISOString(), // Use guaranteed dates
        checkOutDate: checkOutDate.toISOString(), // Use guaranteed dates
        numberOfGuests: numberOfGuests,
        pricing: {
             baseRate: property.pricePerNight, // Store base rate per night
             numberOfNights: numberOfNights,
             cleaningFee: pricingDetails.cleaningFee,
             extraGuestFee: property.extraGuestFee, // Use property's fee definition
             numberOfExtraGuests: Math.max(0, numberOfGuests - property.baseOccupancy),
             accommodationTotal: pricingDetails.basePrice + pricingDetails.extraGuestFee, // Base + extra guest total
             subtotal: pricingDetails.subtotal,
             taxes: 0, // Assuming no taxes for now
             discountAmount: pricingDetails.discountAmount,
             total: pricingDetails.total,
        },
        status: 'pending' as const,
        // Ensure appliedCouponCode is null if no coupon is applied, not undefined
        appliedCouponCode: appliedCoupon?.code ?? null,
      };
      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        throw new Error(pendingBookingResult.error || "Failed to create pending booking.");
      }

      const { bookingId } = pendingBookingResult;
      console.log(`[handleContinueToPayment] Pending booking created: ${bookingId}. Creating Stripe session...`);

      const checkoutInput = {
        property: property,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: numberOfGuests,
        totalPrice: pricingDetails!.total,
        numberOfNights: numberOfNights,
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: email,
        pendingBookingId: bookingId,
      };
      const stripeResult = await import('@/app/actions/create-checkout-session').then(m => m.createCheckoutSession(checkoutInput));

      if (stripeResult.error || !stripeResult.sessionId) {
        throw new Error(stripeResult.error || 'Failed to create Stripe session.');
      }

      console.log(`[handleContinueToPayment] Stripe session created: ${stripeResult.sessionId}. Redirecting...`);

      const stripe = await import('@stripe/stripe-js').then(m => m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!));
      if (!stripe) throw new Error('Stripe.js failed to load.');

      const { error } = await stripe.redirectToCheckout({ sessionId: stripeResult.sessionId });

      if (error) {
        throw new Error(error.message || 'Could not redirect to Stripe.');
      }
      // Redirect happens here, code below won't execute on success

    } catch (error) {
      console.error("Error processing booking:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setFormError(errorMessage);
      toast({
        title: "Booking Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessingBooking(false); // Ensure this runs even on redirect failure
    }
  };

  // --- Availability Alert Logic ---
  const handleNotifyAvailability = async () => {
    if (!datesSelected || !checkInDate || !checkOutDate) return; // Added null checks

    if (notificationMethod === 'email' && !email) {
      toast({ title: "Missing Information", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (notificationMethod === 'sms' && !phone) {
      toast({ title: "Missing Information", description: "Please enter your phone number.", variant: "destructive" });
      return;
    }

    setIsProcessingBooking(true); // Reuse state for notification request
    try {
      // TODO: Implement server action `createAvailabilityAlertAction`
      // const result = await createAvailabilityAlertAction({
      //   propertyId: property.id,
      //   checkInDate: format(checkInDate, 'yyyy-MM-dd'),
      //   checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
      //   contactMethod: notificationMethod,
      //   contactInfo: notificationMethod === 'email' ? email : phone,
      // });
      // if (result.error) throw new Error(result.error);

      console.log("[handleNotifyAvailability] Simulating availability alert request:", {
        propertyId: property.id,
        checkInDate: format(checkInDate, 'yyyy-MM-dd'), // Use guaranteed date
        checkOutDate: format(checkOutDate, 'yyyy-MM-dd'), // Use guaranteed date
        method: notificationMethod,
        contact: notificationMethod === 'email' ? email : phone,
      });
      await new Promise(res => setTimeout(res, 500)); // Simulate API call

      toast({
        title: "Alert Request Saved",
        description: `We'll notify you via ${notificationMethod} if ${format(checkInDate, 'MMM d')} - ${format(checkOutDate, 'MMM d')} becomes available.`,
      });
      setNotifyAvailability(false);

    } catch (error) {
      console.error("Error creating availability alert:", error);
      toast({
        title: "Error Saving Alert",
        description: `Could not save your notification request. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessingBooking(false);
    }
  };


  // --- Render Logic ---
  const renderAvailabilityStatus = () => {
    if (isLoadingAvailability) {
      return (
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Checking Availability...</AlertTitle>
          <AlertDescription>Please wait while we check the dates.</AlertDescription>
        </Alert>
      );
    }
    if (isAvailable === true && datesSelected && checkInDate && checkOutDate) { // Added null checks
      return (
        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Dates Available!</AlertTitle>
          <AlertDescription>
            Good news! The dates {`${format(checkInDate, 'MMM d')} - ${format(checkOutDate, 'MMM d')} (${numberOfNights} nights)`} are available. Please fill in your details below to proceed.
          </AlertDescription>
        </Alert>
      );
    }
    if (isAvailable === false && datesSelected && checkInDate && checkOutDate) { // Added null checks
      return (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Dates Unavailable</AlertTitle>
          <AlertDescription>
            Unfortunately, the selected dates ({`${format(checkInDate, 'MMM d')} - ${format(checkOutDate, 'MMM d')}`}) are not available.
          </AlertDescription>
        </Alert>
      );
    }
    if (!datesSelected) {
      return (
        <Alert variant="default" className="border-yellow-300 bg-yellow-50 text-yellow-800">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertTitle>Select Dates</AlertTitle>
          <AlertDescription>Please select your check-in and check-out dates using the initial form or by selecting alternative dates below.</AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  const renderSuggestedDates = () => {
    if (isLoadingAvailability || isAvailable !== false || suggestedDates.length === 0) {
      return null;
    }
    return (
      <Card className="mt-6 bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-lg text-amber-900">Alternative Dates</CardTitle>
          <CardDescription className="text-amber-800">
            The dates you selected are unavailable. Here are some alternatives:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedDates.map((range, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-between bg-white hover:bg-gray-50 border-gray-300"
              onClick={() => handleSelectAlternativeDate(range)}
            >
              <span>
                {format(range.from, 'MMM d, yyyy')} - {format(range.to, 'MMM d, yyyy')} ({differenceInDays(range.to, range.from)} nights)
              </span>
              {range.recommendation && <Badge variant="secondary">{range.recommendation}</Badge>}
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  };

   const renderAvailabilityCalendar = () => {
     // Only render calendar if dates are unavailable
     if (isAvailable !== false) {
       return null;
     }
     console.log("[renderAvailabilityCalendar] Rendering calendar. Loading:", isLoadingAvailability, "Unavailable Dates:", unavailableDates.length);
     if (isLoadingAvailability && unavailableDates.length === 0) {
       console.log("[renderAvailabilityCalendar] Still loading initial data, skipping render.");
       return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
     }
     const calendarCenterMonth = checkInDate ? startOfMonth(checkInDate) : startOfMonth(new Date());
     console.log("[renderAvailabilityCalendar] Center month:", format(calendarCenterMonth, 'yyyy-MM'));
     return (
       <div className="mt-6">
         <h3 className="text-lg font-semibold mb-3">Availability Calendar</h3>
         <AvailabilityCalendar
           currentMonth={calendarCenterMonth}
           unavailableDates={unavailableDates}
           selectedRange={datesSelected ? { from: checkInDate!, to: checkOutDate! } : undefined}
         />
       </div>
     );
   }

  const renderNotificationForm = () => {
    if (isLoadingAvailability || isAvailable !== false || !datesSelected || !checkInDate || !checkOutDate) return null; // Added null checks
    return (
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">Get Notified</CardTitle>
          <CardDescription className="text-blue-800">
            Want to know if {`${format(checkInDate, 'MMM d')} - ${format(checkOutDate, 'MMM d')}`} become available?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-availability"
                checked={notifyAvailability}
                onCheckedChange={(checked) => setNotifyAvailability(checked as boolean)}
              />
              <Label htmlFor="notify-availability" className="font-medium">
                Yes, notify me if these dates become available.
              </Label>
          </div>

          {notifyAvailability && (
            <>
              <Separator />
              <p className="text-sm font-medium">How should we notify you?</p>
              <RadioGroup
                value={notificationMethod}
                onValueChange={(value) => setNotificationMethod(value as 'email' | 'sms')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="email" id="notify-email" />
                  <Label htmlFor="notify-email" className="flex items-center gap-1"><Mail className="h-4 w-4" /> Email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sms" id="notify-sms" />
                  <Label htmlFor="notify-sms" className="flex items-center gap-1"><Phone className="h-4 w-4" /> SMS</Label>
                </div>
              </RadioGroup>
              {notificationMethod === 'email' && (
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={notificationMethod === 'email'}
                  className="bg-white"
                />
              )}
              {notificationMethod === 'sms' && (
                <Input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={notificationMethod === 'sms'}
                   className="bg-white"
                />
              )}
              <Button
                onClick={handleNotifyAvailability}
                disabled={isProcessingBooking}
                size="sm"
              >
                {isProcessingBooking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Request Notification
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
  }


  return (
    // Apply responsive width constraints
    <div className="max-w-3xl mx-auto w-full px-4 md:px-0"> {/* Max width on larger screens, centered, full width on mobile */}
        {/* Top Section: Availability Info & Alternatives/Calendar */}
        <div className="space-y-6 mb-8">
            {/* Availability Status */}
            {renderAvailabilityStatus()}

            {/* Suggested Dates */}
            {renderSuggestedDates()}

            {/* Availability Calendar - Conditionally Rendered */}
            {renderAvailabilityCalendar()}

            {/* Notification Form */}
            {renderNotificationForm()}
        </div>

        {/* Bottom Section: Booking Summary & Guest Info Form */}
        {/* Conditionally render the booking form only if dates are available */}
        {isAvailable === true && (
            <Card className="w-full"> {/* Form now takes the constrained width */}
                <CardHeader>
                    <CardTitle>Booking Summary & Details</CardTitle>
                    <CardDescription>Confirm details and proceed to payment.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingAvailability ? (
                        <div className="flex justify-center items-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        // Only show the full booking form if dates are available
                        <form onSubmit={handleContinueToPayment} className="space-y-6">

                            {/* Selected Dates & Guests on one line (Desktop) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                                {/* Selected Dates Display */}
                                {datesSelected && checkInDate && checkOutDate && ( // Added null checks
                                    <div className="space-y-1">
                                        <Label>Selected Dates</Label>
                                        <div className="flex items-center justify-between rounded-md border p-2 mt-1 bg-muted/50">
                                            <span className="font-medium text-sm">
                                                {format(checkInDate, 'MMM dd, yyyy')} - {format(checkOutDate, 'MMM dd, yyyy')}
                                            </span>
                                            <span className="text-sm text-muted-foreground">({numberOfNights} nights)</span>
                                        </div>
                                    </div>
                                )}

                                {/* Guest Selector */}
                                <div className="space-y-1">
                                    <Label htmlFor="guests">Number of Guests</Label>
                                    <div className="flex items-center justify-between rounded-md border p-2 mt-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => handleGuestChange(-1)}
                                            disabled={numberOfGuests <= 1 || isProcessingBooking}
                                            aria-label="Decrease guests"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="mx-4 font-medium w-8 text-center" id="guests">
                                            {numberOfGuests}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => handleGuestChange(1)}
                                            disabled={numberOfGuests >= property.maxGuests || isProcessingBooking}
                                            aria-label="Increase guests"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Max {property.maxGuests}. Base for {property.baseOccupancy}.
                                        {property.extraGuestFee > 0 && ` Extra: $${property.extraGuestFee.toFixed(2)}/guest/night.`}
                                    </p>
                                </div>
                            </div>

                             {/* Coupon Code moved here */}
                            <div className="space-y-1 border-b pb-4">
                                <Label htmlFor="coupon">Discount Coupon (Optional)</Label>
                                <div className="flex gap-2">
                                    <Input id="coupon" placeholder="Enter code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={isApplyingCoupon || !!appliedCoupon || isProcessingBooking} />
                                    {!appliedCoupon ? (
                                    <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode.trim() || isProcessingBooking}>
                                        {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketPercent className="h-4 w-4" />}
                                    </Button>
                                    ) : (
                                    <Button type="button" variant="ghost" size="icon" onClick={handleRemoveCoupon} disabled={isProcessingBooking}><X className="h-4 w-4 text-destructive" /></Button>
                                    )}
                                </div>
                                <div className="h-4 text-xs mt-1">
                                    {couponError && <p className="text-destructive">{couponError}</p>}
                                    {appliedCoupon && <p className="text-green-600">Applied: {appliedCoupon.code} ({appliedCoupon.discountPercentage}%)</p>}
                                </div>
                            </div>


                            {/* Price Breakdown */}
                            {pricingDetails && (
                            <div className="space-y-2 text-sm border-b pb-4">
                                <h3 className="font-semibold mb-2">Price Details</h3>
                                <div className="flex justify-between"><span>Base price ({numberOfNights} nights)</span><span>${pricingDetails.basePrice.toFixed(2)}</span></div>
                                {pricingDetails.extraGuestFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Extra guest fee</span><span>+${pricingDetails.extraGuestFee.toFixed(2)}</span></div>}
                                <div className="flex justify-between"><span>Cleaning fee</span><span>+${pricingDetails.cleaningFee.toFixed(2)}</span></div>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-medium"><span>Subtotal</span><span>${pricingDetails.subtotal.toFixed(2)}</span></div>
                                {appliedCoupon && <div className="flex justify-between text-green-600"><span>Discount ({appliedCoupon.code})</span><span>-${pricingDetails.discountAmount.toFixed(2)}</span></div>}
                                {/* Add taxes if applicable */}
                                <Separator className="my-2 font-bold" />
                                <div className="flex justify-between font-bold text-base"><span>Total</span><span>${pricingDetails.total.toFixed(2)}</span></div>
                            </div>
                            )}

                            {/* Guest Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Your Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="firstName">First Name</Label>
                                        <Input id="firstName" name="firstName" value={firstName} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="lastName">Last Name</Label>
                                        <Input id="lastName" name="lastName" value={lastName} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" name="email" type="email" value={email} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input id="phone" name="phone" type="tel" value={phone} onChange={handleGuestInfoChange} required disabled={isProcessingBooking} />
                                    </div>
                                </div>
                            </div>



                            {/* Error Message */}
                            {formError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                            )}

                            {/* Submit Button */}
                            <Button type="submit" className="w-full" disabled={isProcessingBooking}>
                            {isProcessingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                            {isProcessingBooking ? 'Processing...' : 'Continue to Payment'}
                            </Button>

                        </form>
                    )}
                </CardContent>
            </Card>
        )}
    </div>
  );
}
