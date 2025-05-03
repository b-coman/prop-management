
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

interface BookingFormProps {
  property: Property;
  // unavailableDates?: Date[]; // Consider fetching/passing this from Firestore
}

// Mock unavailable dates for demonstration
const mockUnavailableDates = [
  addDays(new Date(), 5),
  addDays(new Date(), 6),
  addDays(new Date(), 10),
  addDays(new Date(), 11),
  addDays(new Date(), 12),
];

// Load Stripe outside component to avoid recreating on every render
// Ensure your Stripe publishable key is in an environment variable
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe functionality will be limited.');
}


export function BookingForm({ property }: BookingFormProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [numberOfNights, setNumberOfNights] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state
  const { toast } = useToast();

  useEffect(() => {
    if (date?.from && date?.to) {
      // Ensure 'to' is strictly after 'from'
      if (date.to > date.from) {
        const nights = differenceInDays(date.to, date.from);
        setNumberOfNights(nights);
        const calculatedPrice = nights * property.pricePerNight + property.cleaningFee;
        setTotalPrice(calculatedPrice);
      } else {
         // Reset if 'to' is not after 'from'
        setNumberOfNights(0);
        setTotalPrice(null);
      }
    } else {
      setNumberOfNights(0);
      setTotalPrice(null);
    }
  }, [date, property.pricePerNight, property.cleaningFee]);


  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      const newCount = prev + change;
      if (newCount < 1) return 1;
      if (newCount > property.maxGuests) return property.maxGuests;
      return newCount;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true); // Start loading

    if (!date?.from || !date?.to) {
       toast({
        title: "Error",
        description: "Please select check-in and check-out dates.",
        variant: "destructive",
      });
       setIsSubmitting(false);
      return;
    }

    if (numberOfNights <= 0) {
       toast({
        title: "Error",
        description: "Check-out date must be after check-in date.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

     if (!totalPrice) {
       toast({
        title: "Error",
        description: "Could not calculate total price.",
        variant: "destructive",
      });
       setIsSubmitting(false);
       return;
    }

    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
       toast({
        title: "Configuration Error",
        description: "Stripe is not configured correctly. Cannot proceed with booking.",
        variant: "destructive",
      });
       setIsSubmitting(false);
       return;
    }


    try {
      // 1. Call the server action to create a checkout session
      const result = await createCheckoutSession({
        property: property,
        checkInDate: date.from.toISOString(),
        checkOutDate: date.to.toISOString(),
        numberOfGuests: numberOfGuests,
        totalPrice: totalPrice,
        numberOfNights: numberOfNights,
      });

       if (result.error || !result.sessionId) {
        throw new Error(result.error || 'Failed to get session ID.');
      }

      const { sessionId } = result;

      // 2. Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
         throw new Error('Stripe.js has not loaded yet.');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error('Stripe redirect error:', error);
        toast({
          title: "Error Redirecting",
          description: error.message || "Could not redirect to Stripe.",
          variant: "destructive",
        });
      }
      // If redirectToCheckout is successful, the user is navigated away,
      // so no need to reset loading state here unless there's an error.

    } catch (error) {
      console.error('Booking submission error:', error);
      toast({
        title: "Booking Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred during booking.",
        variant: "destructive",
      });
       setIsSubmitting(false); // Stop loading on error
    }
     // Don't set submitting false here if redirect is successful
     // setIsSubmitting(false);
  };

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
              disabled={isSubmitting} // Disable while submitting
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
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
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={1} // Show 1 month for simplicity in card
              disabled={[ // Disable past dates and mock unavailable dates
                  { before: new Date() },
                  ...mockUnavailableDates
                ]}
            />
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
        disabled={!date?.from || !date?.to || numberOfNights <= 0 || !totalPrice || isSubmitting} // Add submitting state to disabled condition
        >
        {isSubmitting ? (
           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
