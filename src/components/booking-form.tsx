"use client"; // Required for form handling, state, and Stripe JS

import * as React from 'react';
import { useState, useEffect } from 'react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Users, Minus, Plus, Loader2 } from 'lucide-react'; // Added Loader2
import { DateRange } from 'react-day-picker';
import { loadStripe, type Stripe } from '@stripe/stripe-js'; // Import Stripe JS

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import type { Property } from '@/types';
import { Separator } from './ui/separator';
import { createCheckoutSession } from '@/app/actions/create-checkout-session'; // Import server action
import { getUnavailableDatesForProperty } from '@/services/bookingService'; // Import function to get unavailable dates

interface BookingFormProps {
  property: Property;
}

// Load Stripe outside component to avoid recreating on every render
// Ensure your Stripe publishable key is in an environment variable
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe functionality will be limited.');
}


export function BookingForm({ property }: BookingFormProps) {
  // console.log("--- [BookingForm] Component Rendered ---"); // Reduced logging
  // console.log("[BookingForm] Property ID:", property.id); // Reduced logging
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [numberOfNights, setNumberOfNights] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]); // State for unavailable dates
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const { toast } = useToast();

  // Fetch unavailable dates when the component mounts or property changes
  useEffect(() => {
    // console.log("[BookingForm Effect] Starting to fetch availability for property:", property.id); // Reduced logging
    async function fetchAvailability() {
      setIsLoadingAvailability(true);
      // console.log("[BookingForm fetchAvailability] Set loading state to true."); // Reduced logging
      try {
        // console.log(`[BookingForm fetchAvailability] Calling getUnavailableDatesForProperty for property ${property.id}...`); // Reduced logging
        const unavailable = await getUnavailableDatesForProperty(property.id);
        // console.log(`[BookingForm fetchAvailability] Received ${unavailable.length} unavailable dates for property ${property.id}.`); // Reduced logging
        setUnavailableDates(unavailable);
      } catch (error) {
        console.error(`❌ [BookingForm fetchAvailability] Error fetching property availability for ${property.id}:`, error);
        toast({
          title: "Error Loading Availability",
          description: "Could not load property availability. Please try refreshing the page.",
          variant: "destructive",
        });
        setUnavailableDates([]);
      } finally {
        // console.log("[BookingForm fetchAvailability] Setting loading state to false."); // Reduced logging
        setIsLoadingAvailability(false);
      }
    }

    fetchAvailability();
  }, [property.id, toast]); // Dependency array includes property.id and toast


  useEffect(() => {
    // console.log("[BookingForm Effect] Date range changed:", date); // Reduced logging
    if (date?.from && date?.to) {
      if (date.to > date.from) {
        const nights = differenceInDays(date.to, date.from);
        // console.log(`[BookingForm Effect] Calculated nights: ${nights}`); // Reduced logging
        setNumberOfNights(nights);
        const calculatedPrice = nights * property.pricePerNight + property.cleaningFee;
        // console.log(`[BookingForm Effect] Calculated price: ${calculatedPrice}`); // Reduced logging
        setTotalPrice(calculatedPrice);
      } else {
        // console.log("[BookingForm Effect] Check-out date not after check-in. Resetting price/nights."); // Reduced logging
        setNumberOfNights(0);
        setTotalPrice(null);
      }
    } else {
       // console.log("[BookingForm Effect] Date range incomplete. Resetting price/nights."); // Reduced logging
      setNumberOfNights(0);
      setTotalPrice(null);
    }
  }, [date, property.pricePerNight, property.cleaningFee]); // Recalculate when date or property price changes


  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      const newCount = prev + change;
       // console.log(`[BookingForm handleGuestChange] Attempting to change guests from ${prev} by ${change} to ${newCount}`); // Reduced logging
      if (newCount < 1) {
        // console.log("[BookingForm handleGuestChange] Guest count cannot be less than 1."); // Reduced logging
        return 1;
      }
      if (newCount > property.maxGuests) {
        // console.log(`[BookingForm handleGuestChange] Guest count cannot exceed max guests (${property.maxGuests}).`); // Reduced logging
        return property.maxGuests;
      }
       // console.log(`[BookingForm handleGuestChange] Setting guest count to ${newCount}.`); // Reduced logging
      return newCount;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // console.log("--- [BookingForm handleSubmit] Form submitted ---"); // Reduced logging
    setIsSubmitting(true); // Start loading
    // console.log("[BookingForm handleSubmit] Set submitting state to true."); // Reduced logging

    if (!date?.from || !date?.to) {
       // console.log("[BookingForm handleSubmit] Validation failed: Date range incomplete."); // Reduced logging
       toast({
        title: "Error",
        description: "Please select check-in and check-out dates.",
        variant: "destructive",
      });
       setIsSubmitting(false);
       // console.log("--- [BookingForm handleSubmit] Finished (validation error) ---"); // Reduced logging
      return;
    }

    if (numberOfNights <= 0) {
       // console.log("[BookingForm handleSubmit] Validation failed: Check-out date not after check-in."); // Reduced logging
       toast({
        title: "Error",
        description: "Check-out date must be after check-in date.",
        variant: "destructive",
      });
      setIsSubmitting(false);
       // console.log("--- [BookingForm handleSubmit] Finished (validation error) ---"); // Reduced logging
      return;
    }

     if (!totalPrice) {
        // console.log("[BookingForm handleSubmit] Validation failed: Total price not calculated."); // Reduced logging
       toast({
        title: "Error",
        description: "Could not calculate total price.",
        variant: "destructive",
      });
       setIsSubmitting(false);
        // console.log("--- [BookingForm handleSubmit] Finished (validation error) ---"); // Reduced logging
       return;
    }

    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
        console.error("❌ [BookingForm handleSubmit] Stripe Publishable Key not set!");
       toast({
        title: "Configuration Error",
        description: "Stripe is not configured correctly. Cannot proceed with booking.",
        variant: "destructive",
      });
       setIsSubmitting(false);
        // console.log("--- [BookingForm handleSubmit] Finished (config error) ---"); // Reduced logging
       return;
    }


    try {
      // console.log("[BookingForm handleSubmit] Calling createCheckoutSession server action..."); // Reduced logging
      // 1. Call the server action to create a checkout session
      const checkoutInput = {
        property: property,
        checkInDate: date.from.toISOString(),
        checkOutDate: date.to.toISOString(),
        numberOfGuests: numberOfGuests,
        totalPrice: totalPrice,
        numberOfNights: numberOfNights,
      };
      // console.log("[BookingForm handleSubmit] Checkout Session Input:", JSON.stringify(checkoutInput, null, 2)); // Reduced logging
      const result = await createCheckoutSession(checkoutInput);
      // console.log("[BookingForm handleSubmit] createCheckoutSession Result:", result); // Reduced logging


       if (result.error || !result.sessionId) {
         console.error("❌ [BookingForm handleSubmit] Error from createCheckoutSession:", result.error || 'Missing session ID.');
        throw new Error(result.error || 'Failed to get session ID.');
      }

      const { sessionId } = result;
      // console.log(`[BookingForm handleSubmit] Received Stripe Session ID: ${sessionId}`); // Reduced logging


      // 2. Redirect to Stripe Checkout
      // console.log("[BookingForm handleSubmit] Attempting to load Stripe.js..."); // Reduced logging
      const stripe = await stripePromise;
      if (!stripe) {
         console.error("❌ [BookingForm handleSubmit] Stripe.js failed to load.");
         throw new Error('Stripe.js has not loaded yet.');
      }
      // console.log("[BookingForm handleSubmit] Stripe.js loaded. Redirecting to checkout..."); // Reduced logging

      const { error } = await stripe.redirectToCheckout({ sessionId });

      // This part is only reached if redirectToCheckout fails immediately
      if (error) {
        console.error('❌ [BookingForm handleSubmit] Stripe redirect error:', error);
        toast({
          title: "Error Redirecting",
          description: error.message || "Could not redirect to Stripe.",
          variant: "destructive",
        });
         setIsSubmitting(false); // Stop loading on redirect error
      } else {
          // console.log("[BookingForm handleSubmit] Redirecting to Stripe..."); // Reduced logging
          // User is redirected, no need to set submitting false here.
      }


    } catch (error) {
      console.error('❌ [BookingForm handleSubmit] Booking submission error:', error);
      toast({
        title: "Booking Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred during booking.",
        variant: "destructive",
      });
       setIsSubmitting(false); // Stop loading on error
    }
     // console.log("--- [BookingForm handleSubmit] Finished execution (unless redirected) ---"); // Reduced logging
     // Don't set submitting false here if redirect is successful
  };

  // console.log("[BookingForm Render] Current state: isLoadingAvailability=", isLoadingAvailability, "isSubmitting=", isSubmitting, "date=", date); // Reduced logging

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Date Range Picker */}
      <div className={cn('grid gap-2')}>
         <Label htmlFor="date">Check-in / Check-out Dates</Label>
         <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
              disabled={isSubmitting || isLoadingAvailability} // Disable while submitting or loading availability
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {isLoadingAvailability ? (
                <span>Loading availability...</span>
              ) : date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'LLL dd, y')} -{' '}
                    {format(date.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(date.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
             {isLoadingAvailability ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
             ) : (
                 <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from || new Date()} // Use current month if no date selected
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1} // Show 1 month for simplicity in card
                  disabled={[ // Disable past dates and fetched unavailable dates
                      { before: new Date(new Date().setHours(0, 0, 0, 0)) }, // Disable dates before today accurately
                      ...unavailableDates // Spread the fetched unavailable dates
                    ]}
                 />
             )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Guest Selector */}
       <div>
        <Label htmlFor="guests">Number of Guests</Label>
        <div className="flex items-center justify-between rounded-md border p-2 mt-1">
           <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGuestChange(-1)}
              disabled={numberOfGuests <= 1 || isSubmitting} // Disable while submitting
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
              disabled={numberOfGuests >= property.maxGuests || isSubmitting} // Disable while submitting
              aria-label="Increase guests"
            >
              <Plus className="h-4 w-4" />
            </Button>
        </div>
         <p className="text-xs text-muted-foreground mt-1">Max {property.maxGuests} guests</p>
      </div>


      {/* Price Calculation */}
       {totalPrice !== null && numberOfNights > 0 && (
        <div className="space-y-2 text-sm">
          <Separator className="my-4" />
          <div className="flex justify-between">
            <span>
              ${property.pricePerNight} x {numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'}
            </span>
            <span>${(property.pricePerNight * numberOfNights).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cleaning fee</span>
            <span>${property.cleaningFee.toFixed(2)}</span>
          </div>
           {/* Add other fees like service fee if applicable */}
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        disabled={!date?.from || !date?.to || numberOfNights <= 0 || !totalPrice || isSubmitting || isLoadingAvailability} // Add loading states to disabled condition
        >
        {isSubmitting ? (
           <>
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             Processing...
           </>
         ) : isLoadingAvailability ? (
             'Loading Availability...'
         ) : (
           'Proceed to Payment' // Updated button text
         )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
         You will be redirected to Stripe to complete your payment.
      </p>
    </form>
  );
}
