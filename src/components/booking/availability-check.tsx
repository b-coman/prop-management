// src/components/booking/availability-check.tsx
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
  Minus,
  Plus,
  Bath,
  Home,
  Building,
  Wind,
} from 'lucide-react';

import type { Property, Coupon, Availability, CurrencyCode } from '@/types';
import type { Stripe } from '@stripe/stripe-js';
import { getUnavailableDatesForProperty } from '@/services/bookingService';
import { validateAndApplyCoupon } from '@/services/couponService';
import { createPendingBookingAction } from '@/app/actions/booking-actions';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvailabilityCalendar } from './availability-calendar';
import { calculatePrice } from '@/lib/price-utils';
import { useSessionStorage } from '@/hooks/use-session-storage';
import { Badge } from '@/components/ui/badge';
import { useSanitizedState } from '@/hooks/useSanitizedState';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import { useCurrency } from '@/contexts/CurrencyContext'; // Import useCurrency

interface AvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

const parseDateSafe = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? startOfDay(parsed) : null;
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
  const { selectedCurrency, convertToSelectedCurrency, formatPrice, baseCurrencyForProperty } = useCurrency();
  const propertySlug = property.slug;
  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency);

  const [checkInDate, setCheckInDate] = useState<Date | null>(parseDateSafe(initialCheckIn));
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(parseDateSafe(initialCheckOut));
  // Ensure a valid number is provided as the initial value for guests
  const [numberOfGuests, setNumberOfGuests] = useSessionStorage<number>(`booking_${propertySlug}_guests`, property.baseOccupancy || 1);

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [suggestedDates, setSuggestedDates] = useState<Array<{ from: Date; to: Date; recommendation?: string }>>([]);

  const [initialFirstNameFromSession, setInitialFirstNameInSession] = useSessionStorage<string>(`booking_${propertySlug}_firstName`, '');
  const [firstName, setFirstName] = useSanitizedState(initialFirstNameFromSession, sanitizeText);
  useEffect(() => { setInitialFirstNameInSession(firstName); }, [firstName, setInitialFirstNameInSession]);

  const [initialLastNameFromSession, setInitialLastNameInSession] = useSessionStorage<string>(`booking_${propertySlug}_lastName`, '');
  const [lastName, setLastName] = useSanitizedState(initialLastNameFromSession, sanitizeText);
  useEffect(() => { setInitialLastNameInSession(lastName); }, [lastName, setInitialLastNameInSession]);

  const [initialEmailFromSession, setInitialEmailInSession] = useSessionStorage<string>(`booking_${propertySlug}_email`, '');
  const [email, setEmail] = useSanitizedState(initialEmailFromSession, sanitizeEmail);
  useEffect(() => { setInitialEmailInSession(email); }, [email, setInitialEmailInSession]);

  const [initialPhoneFromSession, setInitialPhoneInSession] = useSessionStorage<string>(`booking_${propertySlug}_phone`, '');
  const [phone, setPhone] = useSanitizedState(initialPhoneFromSession, sanitizePhone);
  useEffect(() => { setInitialPhoneInSession(phone); }, [phone, setInitialPhoneInSession]);

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [notifyAvailability, setNotifyAvailability] = useState(false);
  const [notificationMethod, setNotificationMethod] = useState<'email' | 'sms'>('email');

  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const datesSelected = checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate) && isAfter(checkOutDate, checkInDate);
  const numberOfNights = useMemo(() => {
    if (datesSelected && checkInDate && checkOutDate) {
      return differenceInDays(startOfDay(checkOutDate), startOfDay(checkInDate));
    }
    return 0;
  }, [checkInDate, checkOutDate, datesSelected]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      setStripePromise(import('@stripe/stripe-js').then(m => m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)));
    } else {
      console.error("Stripe Publishable Key not found in environment variables.");
    }
  }, []);

  const pricingDetailsInBaseCurrency = useMemo(() => {
    if (datesSelected && numberOfGuests > 0) {
      return calculatePrice(
        property.pricePerNight,
        numberOfNights,
        property.cleaningFee ?? 0,
        numberOfGuests,
        property.baseOccupancy,
        property.extraGuestFee ?? 0,
        property.baseCurrency,
        appliedCoupon?.discountPercentage
      );
    }
    return null;
  }, [datesSelected, property, numberOfNights, numberOfGuests, appliedCoupon]);

  const pricingDetailsForDisplay = useMemo(() => {
    if (pricingDetailsInBaseCurrency) {
      return {
        basePrice: convertToSelectedCurrency(pricingDetailsInBaseCurrency.basePrice, propertyBaseCcy),
        extraGuestFee: convertToSelectedCurrency(pricingDetailsInBaseCurrency.extraGuestFeeTotal, propertyBaseCcy),
        cleaningFee: convertToSelectedCurrency(pricingDetailsInBaseCurrency.cleaningFee, propertyBaseCcy),
        subtotal: convertToSelectedCurrency(pricingDetailsInBaseCurrency.subtotal, propertyBaseCcy),
        discountAmount: convertToSelectedCurrency(pricingDetailsInBaseCurrency.discountAmount, propertyBaseCcy),
        total: convertToSelectedCurrency(pricingDetailsInBaseCurrency.total, propertyBaseCcy),
      };
    }
    return null;
  }, [pricingDetailsInBaseCurrency, convertToSelectedCurrency, propertyBaseCcy]);


  const checkPropertyAvailability = useCallback(async () => {
    if (!datesSelected || !checkInDate || !checkOutDate) {
      setIsAvailable(null);
      setIsLoadingAvailability(false);
      setSuggestedDates([]);
      return;
    }

    setIsLoadingAvailability(true);
    setIsAvailable(null);
    setSuggestedDates([]);

    try {
      const fetchedUnavailableDates = await getUnavailableDatesForProperty(propertySlug);
      setUnavailableDates(fetchedUnavailableDates);

      let conflict = false;
      let current = new Date(checkInDate.getTime());
      while (isBefore(current, checkOutDate)) {
        const dateString = format(startOfDay(current), 'yyyy-MM-dd');
        if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
          conflict = true;
          break;
        }
        current = addDays(current, 1);
      }
      setIsAvailable(!conflict);

      if (conflict) {
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
          return isValidSuggestion && !isBefore(startOfDay(range.from), startOfDay(new Date()));
        });
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
  }, [checkInDate, checkOutDate, datesSelected, propertySlug, numberOfNights, toast]);

  useEffect(() => {
    checkPropertyAvailability();
  }, [checkPropertyAvailability]);

  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      // Ensure prev is a number before calculation
      const currentGuests = typeof prev === 'number' && !isNaN(prev) ? prev : (property.baseOccupancy || 1);
      const newCount = currentGuests + change;
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };


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
    if (!datesSelected || !checkInDate || !checkOutDate) {
      setCouponError('Please select valid booking dates first.');
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);
    setAppliedCoupon(null);

    try {
      const result = await validateAndApplyCoupon(couponCode.trim(), checkInDate, checkOutDate, propertySlug);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Explicitly check if numberOfGuests is a valid number
     if (typeof numberOfGuests !== 'number' || isNaN(numberOfGuests) || numberOfGuests < 1 || numberOfGuests > property.maxGuests) {
       setFormError(`Number of guests must be between 1 and ${property.maxGuests}.`);
       return;
     }

    if (!datesSelected || isAvailable !== true || !checkInDate || !checkOutDate) {
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

    if (!pricingDetailsInBaseCurrency) {
      setFormError("Could not calculate pricing. Please try again.");
      return;
    }

    setIsProcessingBooking(true);

    try {
      // Send pricing in property's base currency to the backend
      const bookingInput = {
        propertyId: propertySlug,
        guestInfo: { firstName, lastName, email, phone },
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: numberOfGuests,
        pricing: {
          ...pricingDetailsInBaseCurrency, // Use base currency details
          currency: propertyBaseCcy, // Explicitly state the currency
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCoupon?.code ?? null,
      };
      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        throw new Error(pendingBookingResult.error || "Failed to create pending booking.");
      }

      const { bookingId } = pendingBookingResult;

      // Stripe checkout session should receive total price in the property's base currency
      const checkoutInput = {
        property: property, // Property object contains baseCurrency
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: numberOfGuests,
        totalPrice: pricingDetailsInBaseCurrency.total, // Total in base currency
        numberOfNights: numberOfNights,
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: email,
        pendingBookingId: bookingId,
      };

      const stripeResult = await import('@/app/actions/create-checkout-session').then(m => m.createCheckoutSession(checkoutInput));

      if (stripeResult.error || !stripeResult.sessionId || !stripeResult.sessionUrl) {
        throw new Error(stripeResult.error || 'Failed to create Stripe session or missing session URL.');
      }

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');

      const { error } = await stripe.redirectToCheckout({ sessionId: stripeResult.sessionId });

      if (error) {
        if (error.name === 'SecurityError' && error.message.includes('permission to navigate the target frame')) {
             console.error("[Stripe Redirect Error] SecurityError: Likely due to cross-origin restrictions in the iframe environment. Redirection might be blocked.");
             setFormError("Could not redirect to Stripe due to security restrictions in this environment. Please try booking from the deployed site.");
           } else {
             throw new Error(error.message || 'Could not redirect to Stripe.');
           }
      }
      // No need to redirect here, Stripe handles it

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
      setIsProcessingBooking(false);
    }
  };

  const handleNotifyAvailability = async () => {
    if (!datesSelected || !checkInDate || !checkOutDate) return;

    if (notificationMethod === 'email' && !email) {
      toast({ title: "Missing Information", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (notificationMethod === 'sms' && !phone) {
      toast({ title: "Missing Information", description: "Please enter your phone number.", variant: "destructive" });
      return;
    }

    setIsProcessingBooking(true);
    try {
      console.log("[handleNotifyAvailability] Simulating availability alert request:", {
        propertyId: propertySlug,
        checkInDate: format(checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
        method: notificationMethod,
        contact: notificationMethod === 'email' ? email : phone,
      });
      await new Promise(res => setTimeout(res, 500));

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
    if (isAvailable === true && datesSelected && checkInDate && checkOutDate) {
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
    if (isAvailable === false && datesSelected && checkInDate && checkOutDate) {
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
      // Only render if dates are unavailable AND the component is not loading availability
      if (isAvailable === true || isLoadingAvailability) {
          return null;
      }
      const validCheckIn = checkInDate && isValid(checkInDate) ? checkInDate : new Date();
      const calendarCenterMonth = startOfMonth(validCheckIn);
      return (
          <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Availability Calendar</h3>
              <AvailabilityCalendar
                  currentMonth={calendarCenterMonth}
                  unavailableDates={unavailableDates}
                  selectedRange={datesSelected && checkInDate && checkOutDate ? { from: checkInDate, to: checkOutDate } : undefined}
              />
          </div>
      );
  };


  const renderNotificationForm = () => {
    if (isLoadingAvailability || isAvailable !== false || !datesSelected || !checkInDate || !checkOutDate) return null;
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

  // Render guest count safely
  const guestsDisplay = typeof numberOfGuests === 'number' && !isNaN(numberOfGuests) ? numberOfGuests : (property.baseOccupancy || 1);

  return (
    <div className="max-w-xl mx-auto w-full px-4 md:px-0">
      <div className="space-y-6 mb-8">
        {renderAvailabilityStatus()}
        {renderSuggestedDates()}
        {renderAvailabilityCalendar()}
        {renderNotificationForm()}
      </div>

      {isAvailable === true && (
        <Card className="w-full">
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
              <form onSubmit={handleContinueToPayment} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end border-b pb-4">
                      {datesSelected && checkInDate && checkOutDate && (
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
                      <div className="space-y-1">
                          <Label htmlFor="guests">Number of Guests</Label>
                          <div className="flex items-center justify-between rounded-md border p-2 mt-1">
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleGuestChange(-1)}
                                  disabled={guestsDisplay <= 1 || isProcessingBooking}
                                  aria-label="Decrease guests"
                              >
                                  <Minus className="h-4 w-4" />
                              </Button>
                              <span className="mx-4 font-medium w-8 text-center" id="guests">
                                  {guestsDisplay} {/* Render safe value */}
                              </span>
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleGuestChange(1)}
                                  disabled={guestsDisplay >= property.maxGuests || isProcessingBooking}
                                  aria-label="Increase guests"
                              >
                                  <Plus className="h-4 w-4" />
                              </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                              Max {property.maxGuests}. Base for {property.baseOccupancy}.
                              {(property.extraGuestFee ?? 0) > 0 && ` Extra: ${formatPrice(property.extraGuestFee, propertyBaseCcy)}/guest/night.`}
                          </p>
                      </div>
                      {/* Coupon Code - Moved here */}
                      <div className="space-y-1 md:col-span-2">
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
                  </div>

                {pricingDetailsForDisplay && (
                  <div className="space-y-2 text-sm border-b pb-4">
                    <h3 className="font-semibold mb-2">Price Details ({selectedCurrency})</h3>
                    <div className="flex justify-between"><span>Base price ({numberOfNights} nights)</span><span>{formatPrice(pricingDetailsForDisplay.basePrice, selectedCurrency)}</span></div>
                    {pricingDetailsForDisplay.extraGuestFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Extra guest fee</span><span>+{formatPrice(pricingDetailsForDisplay.extraGuestFee, selectedCurrency)}</span></div>}
                    <div className="flex justify-between"><span>Cleaning fee</span><span>+{formatPrice(pricingDetailsForDisplay.cleaningFee, selectedCurrency)}</span></div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-medium"><span>Subtotal</span><span>{formatPrice(pricingDetailsForDisplay.subtotal, selectedCurrency)}</span></div>
                    {appliedCoupon && <div className="flex justify-between text-green-600"><span>Discount ({appliedCoupon.code})</span><span>-{formatPrice(pricingDetailsForDisplay.discountAmount, selectedCurrency)}</span></div>}
                    <Separator className="my-2 font-bold" />
                    <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatPrice(pricingDetailsForDisplay.total, selectedCurrency)}</span></div>
                  </div>
                )}
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
                {formError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
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
