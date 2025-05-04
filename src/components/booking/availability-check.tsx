
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Use useSearchParams client-side
import Image from 'next/image';
import { format, differenceInDays, addDays, parseISO, isValid, isBefore, startOfDay } from 'date-fns';
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
} from 'lucide-react';

import type { Property, Coupon } from '@/types';
import { getUnavailableDatesForProperty } from '@/services/bookingService';
import { validateAndApplyCoupon } from '@/services/couponService';
import { createPendingBookingAction } from '@/app/actions/booking-actions'; // New server action

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvailabilityCalendar } from './availability-calendar'; // Assuming this component exists
import { calculatePrice } from '@/lib/price-utils'; // Centralized price calculation logic
import { useSessionStorage } from '@/hooks/use-session-storage'; // Hook for session storage

interface AvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string; // YYYY-MM-DD
  initialCheckOut?: string; // YYYY-MM-DD
  initialGuests?: number;
}

// Function to parse date strings safely
const parseDateSafe = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export function AvailabilityCheck({
  property,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
}: AvailabilityCheckProps) {
  const router = useRouter();
  const searchParams = useSearchParams(); // Get search params client-side if needed for fallbacks
  const { toast } = useToast();

  // --- State Management ---
  const [checkInDate, setCheckInDate] = useSessionStorage<Date | null>(`booking_${property.id}_checkIn`, parseDateSafe(initialCheckIn) || parseDateSafe(searchParams.get('checkIn')));
  const [checkOutDate, setCheckOutDate] = useSessionStorage<Date | null>(`booking_${property.id}_checkOut`, parseDateSafe(initialCheckOut) || parseDateSafe(searchParams.get('checkOut')));
  const [numberOfGuests, setNumberOfGuests] = useSessionStorage<number>(`booking_${property.id}_guests`, initialGuests || parseInt(searchParams.get('guests') || '1', 10));

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
    if (datesSelected) {
      return differenceInDays(checkOutDate, checkInDate);
    }
    return 0;
  }, [checkInDate, checkOutDate, datesSelected]);

  const pricingDetails = useMemo(() => {
    if (datesSelected) {
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
    if (!datesSelected) {
      setIsAvailable(null); // Reset if dates are invalid
      setIsLoadingAvailability(false);
      setSuggestedDates([]); // Clear suggestions
      return;
    }

    setIsLoadingAvailability(true);
    setIsAvailable(null); // Reset availability status
    setSuggestedDates([]); // Clear suggestions

    try {
      const fetchedUnavailableDates = await getUnavailableDatesForProperty(property.id);
      setUnavailableDates(fetchedUnavailableDates);

      // Check if any date within the selected range (inclusive start, exclusive end) is unavailable
      let conflict = false;
      let current = new Date(checkInDate!.getTime());
      while (isBefore(current, checkOutDate!)) {
        const dateString = format(startOfDay(current), 'yyyy-MM-dd'); // Use startOfDay for comparison
        if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
          conflict = true;
          break;
        }
        current = addDays(current, 1);
      }

      setIsAvailable(!conflict);

      if (conflict) {
        // Placeholder for suggesting alternative dates
        // TODO: Replace with actual logic (potentially AI-driven in the future)
        const suggested = [
          { from: addDays(checkOutDate!, 1), to: addDays(checkOutDate!, 1 + numberOfNights), recommendation: "Next Available" },
          { from: addDays(checkInDate!, 7), to: addDays(checkInDate!, 7 + numberOfNights) },
          // Add more sophisticated suggestions later
        ];
        // Filter suggestions to ensure they don't conflict with fetched unavailable dates
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
           return isValidSuggestion;
        });

        setSuggestedDates(validSuggestions.slice(0, 3)); // Show max 3 suggestions
      }

    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Error Checking Availability",
        description: "Could not check property availability. Please try again.",
        variant: "destructive",
      });
      setIsAvailable(false); // Assume unavailable on error
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [checkInDate, checkOutDate, datesSelected, property.id, numberOfNights, toast]);

  // Re-check availability when dates change
  useEffect(() => {
    checkPropertyAvailability();
  }, [checkPropertyAvailability]); // Dependency on the memoized callback

  // --- Form Submission & Booking Logic ---

  const handleGuestInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'firstName') setFirstName(value);
    else if (name === 'lastName') setLastName(value);
    else if (name === 'email') setEmail(value);
    else if (name === 'phone') setPhone(value);
  };

  const handleApplyCoupon = async () => {
    // (Similar logic as in the original BookingForm, adapted for this component)
    if (!couponCode.trim()) {
       setCouponError('Please enter a coupon code.');
       return;
     }
     if (!datesSelected) { // Need valid dates to check coupon validity
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
    // Availability will re-check via useEffect
  };

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Basic client-side validation
    if (!datesSelected || !isAvailable) {
      setFormError("Selected dates are not available or invalid.");
      return;
    }
    if (!firstName || !lastName || !email) {
      setFormError("Please fill in your first name, last name, and email.");
      return;
    }
    // Basic email format check (more robust validation is better)
    if (!/\S+@\S+\.\S+/.test(email)) {
        setFormError("Please enter a valid email address.");
        return;
    }
     if (!phone) { // Making phone mandatory for this example
        setFormError("Please enter your phone number.");
        return;
     }

    setIsProcessingBooking(true);

    try {
      // 1. Create Pending Booking
      const bookingInput = {
        propertyId: property.id,
        guestInfo: { firstName, lastName, email, phone },
        checkInDate: checkInDate!.toISOString(),
        checkOutDate: checkOutDate!.toISOString(),
        numberOfGuests: numberOfGuests,
        pricing: pricingDetails!, // Should be calculated by now
        status: 'pending' as const, // Explicitly set to pending
        appliedCouponCode: appliedCoupon?.code,
      };

      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        throw new Error(pendingBookingResult.error || "Failed to create pending booking.");
      }

      const { bookingId } = pendingBookingResult;

      // 2. Create Stripe Checkout Session (using existing action, potentially pass bookingId)
      // TODO: Modify createCheckoutSession if needed to include bookingId in metadata
      const checkoutInput = {
        property: property,
        checkInDate: checkInDate!.toISOString(),
        checkOutDate: checkOutDate!.toISOString(),
        numberOfGuests: numberOfGuests,
        totalPrice: pricingDetails!.total,
        numberOfNights: numberOfNights,
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        // Add guest info and potentially the pending booking ID to metadata
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: email,
        pendingBookingId: bookingId, // Pass the ID to link payment
      };

      // Redirect to Stripe (logic similar to original form)
      const stripeResult = await import('@/app/actions/create-checkout-session').then(m => m.createCheckoutSession(checkoutInput));

       if (stripeResult.error || !stripeResult.sessionId) {
           // TODO: Handle failure - maybe update pending booking to 'failed' or 'cancelled'?
           throw new Error(stripeResult.error || 'Failed to create Stripe session.');
       }

       const stripe = await import('@stripe/stripe-js').then(m => m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!));
       if (!stripe) throw new Error('Stripe.js failed to load.');

       const { error } = await stripe.redirectToCheckout({ sessionId: stripeResult.sessionId });

       if (error) {
           // TODO: Handle Stripe redirect failure
           throw new Error(error.message || 'Could not redirect to Stripe.');
       }
       // User is redirected, no need to set loading false here

    } catch (error) {
      console.error("Error processing booking:", error);
      setFormError(error instanceof Error ? error.message : "An unexpected error occurred.");
      setIsProcessingBooking(false);
      toast({
        title: "Booking Error",
        description: error instanceof Error ? error.message : "Could not proceed to payment.",
        variant: "destructive",
      });
    }
  };

   // --- Availability Alert Logic ---
   const handleNotifyAvailability = async () => {
        if (!datesSelected) return; // Should not happen if button is shown

        // Basic validation for notification contact info
        if (notificationMethod === 'email' && !email) {
            toast({ title: "Missing Information", description: "Please enter your email address.", variant: "destructive"});
            return;
        }
        if (notificationMethod === 'sms' && !phone) {
            toast({ title: "Missing Information", description: "Please enter your phone number.", variant: "destructive"});
            return;
        }

        setIsProcessingBooking(true); // Reuse loading state for alert request
        try {
            // TODO: Implement server action `createAvailabilityAlertAction`
            // This action should save the request to a new 'availabilityAlerts' Firestore collection
            // Example data: { propertyId, checkInDate, checkOutDate, contactMethod: notificationMethod, contactInfo: (notificationMethod === 'email' ? email : phone), status: 'active', createdAt }
            console.log("Simulating availability alert request:", {
                propertyId: property.id,
                checkInDate: format(checkInDate!, 'yyyy-MM-dd'),
                checkOutDate: format(checkOutDate!, 'yyyy-MM-dd'),
                method: notificationMethod,
                contact: notificationMethod === 'email' ? email : phone,
            });
            // await createAvailabilityAlertAction({ ... }); // Call the actual action here

            await new Promise(res => setTimeout(res, 500)); // Simulate API call

            toast({
                title: "Alert Request Saved",
                description: `We'll notify you via ${notificationMethod} if ${format(checkInDate!, 'MMM d')} - ${format(checkOutDate!, 'MMM d')} becomes available.`,
            });
             setNotifyAvailability(false); // Hide the notification form section after successful request

        } catch (error) {
            console.error("Error creating availability alert:", error);
            toast({
                title: "Error Saving Alert",
                description: "Could not save your notification request. Please try again.",
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
    if (isAvailable === true) {
      return (
        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Dates Available!</AlertTitle>
          <AlertDescription>
            Good news! The dates {format(checkInDate!, 'MMM d')} - {format(checkOutDate!, 'MMM d')} ({numberOfNights} nights) are available. Please fill in your details below to proceed.
          </AlertDescription>
        </Alert>
      );
    }
    if (isAvailable === false) {
      return (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Dates Unavailable</AlertTitle>
          <AlertDescription>
            Unfortunately, the selected dates ({format(checkInDate!, 'MMM d')} - {format(checkOutDate!, 'MMM d')}) are not available.
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
    return null; // Should not happen if logic is correct
  };

  const renderSuggestedDates = () => {
    if (isLoadingAvailability || isAvailable || suggestedDates.length === 0) {
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
      // Only render calendar if dates are unavailable, or maybe always show it?
      // For now, show it when unavailableDates are loaded, regardless of current availability status
      if (isLoadingAvailability && unavailableDates.length === 0) return null; // Don't show while initially loading unless already have data

      // Determine months to show: current month, previous, next
      const displayMonth = checkInDate || new Date();
      const previousMonth = addDays(startOfMonth(displayMonth), -15); // Go back roughly a month
      const nextMonth = addDays(startOfMonth(displayMonth), 45); // Go forward roughly a month

      return (
          <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Availability Calendar</h3>
              <AvailabilityCalendar
                  currentMonth={displayMonth} // Center around selected/current month
                  unavailableDates={unavailableDates}
                  selectedRange={datesSelected ? { from: checkInDate!, to: checkOutDate! } : undefined}
                  numberOfMonths={3} // Show 3 months (prev, current, next logic handled internally or needs adjustment)
              />
          </div>
      );
  }

  const renderNotificationForm = () => {
     if (isLoadingAvailability || isAvailable !== false) return null;

     return (
        <Card className="mt-6 bg-blue-50 border-blue-200">
            <CardHeader>
                <CardTitle className="text-lg text-blue-900">Get Notified</CardTitle>
                 <CardDescription className="text-blue-800">
                     Want to know if {format(checkInDate!, 'MMM d')} - {format(checkOutDate!, 'MMM d')} becomes available?
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Checkbox
                    id="notify-availability"
                    checked={notifyAvailability}
                    onCheckedChange={(checked) => setNotifyAvailability(checked as boolean)}
                />
                <Label htmlFor="notify-availability" className="ml-2 font-medium">
                    Yes, notify me if these dates become available.
                </Label>

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

                        {/* Conditionally show required input fields */}
                         {notificationMethod === 'email' && (
                            <Input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required={notificationMethod === 'email'}
                            />
                        )}
                         {notificationMethod === 'sms' && (
                            <Input
                                type="tel"
                                placeholder="Enter your phone number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required={notificationMethod === 'sms'}
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">

      {/* Left Column: Property Info & Calendar/Alternatives */}
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{property.name}</CardTitle>
            <CardDescription>{property.shortDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 items-start">
            {property.images[0] && (
              <div className="relative w-full sm:w-1/3 aspect-video rounded-md overflow-hidden flex-shrink-0">
                <Image
                  src={property.images[0].url}
                  alt={property.images[0].alt || property.name}
                  fill
                  style={{ objectFit: 'cover' }}
                   data-ai-hint={property.images[0]['data-ai-hint']}
                />
              </div>
            )}
            <div className="text-sm">
               <p className="font-medium">Selected Dates:</p>
                <p className="text-muted-foreground mb-2">
                 {datesSelected ? `${format(checkInDate!, 'MMM d, yyyy')} - ${format(checkOutDate!, 'MMM d, yyyy')} (${numberOfNights} nights)` : 'Please select dates'}
               </p>
               <p className="font-medium">Guests:</p>
               <p className="text-muted-foreground">{numberOfGuests}</p>
            </div>
          </CardContent>
        </Card>

         {/* Availability Status */}
         {renderAvailabilityStatus()}

        {/* Suggested Dates */}
        {renderSuggestedDates()}

        {/* Availability Calendar */}
        {renderAvailabilityCalendar()}

         {/* Notification Form */}
         {renderNotificationForm()}
      </div>

      {/* Right Column: Price & Guest Info Form */}
      <div className="md:col-span-1">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
            <CardDescription>Confirm details and proceed to payment.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAvailability ? (
                 <div className="flex justify-center items-center p-8">
                     <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
            ) : !datesSelected ? (
                 <p className="text-center text-muted-foreground py-4">Select dates to see pricing.</p>
            ) : !isAvailable ? (
                 <p className="text-center text-destructive py-4">Selected dates are unavailable.</p>
            ) : (
              <form onSubmit={handleContinueToPayment} className="space-y-6">
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
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <Label htmlFor="firstName">First Name</Label>
                       <Input id="firstName" name="firstName" value={firstName} onChange={handleGuestInfoChange} required />
                     </div>
                     <div className="space-y-1">
                       <Label htmlFor="lastName">Last Name</Label>
                       <Input id="lastName" name="lastName" value={lastName} onChange={handleGuestInfoChange} required />
                     </div>
                   </div>
                   <div className="space-y-1">
                     <Label htmlFor="email">Email</Label>
                     <Input id="email" name="email" type="email" value={email} onChange={handleGuestInfoChange} required />
                   </div>
                   <div className="space-y-1">
                     <Label htmlFor="phone">Phone Number</Label>
                     <Input id="phone" name="phone" type="tel" value={phone} onChange={handleGuestInfoChange} required />
                   </div>
                 </div>

                 {/* Coupon Code */}
                 <div className="space-y-1 pt-4 border-t">
                   <Label htmlFor="coupon">Discount Coupon (Optional)</Label>
                   <div className="flex gap-2">
                     <Input id="coupon" placeholder="Enter code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={isApplyingCoupon || !!appliedCoupon} />
                     {!appliedCoupon ? (
                       <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode.trim()}>
                         {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketPercent className="h-4 w-4" />}
                       </Button>
                     ) : (
                       <Button type="button" variant="ghost" size="icon" onClick={handleRemoveCoupon}><X className="h-4 w-4 text-destructive" /></Button>
                     )}
                   </div>
                   <div className="h-4 text-xs mt-1">
                     {couponError && <p className="text-destructive">{couponError}</p>}
                     {appliedCoupon && <p className="text-green-600">Applied: {appliedCoupon.code} ({appliedCoupon.discountPercentage}%)</p>}
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
                <Button type="submit" className="w-full" disabled={isProcessingBooking || !isAvailable}>
                  {isProcessingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {isProcessingBooking ? 'Processing...' : 'Continue to Payment'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
