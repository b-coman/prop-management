
"use client"; // Required for form handling, state, and Stripe JS

import * as React from 'react';
import { useState, useEffect } from 'react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker'; // Ensure DateRange is imported
import { Calendar as CalendarIcon, Users, Minus, Plus, Loader2, TestTubeDiagonal } from 'lucide-react'; // Added Loader2 and TestTubeDiagonal

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Although not used for guests, keep import if needed elsewhere
import { useToast } from "@/hooks/use-toast";
import type { Property, Booking } from '@/types'; // Import Booking type for status
import { Separator } from './ui/separator';
import { createCheckoutSession } from '@/app/actions/create-checkout-session'; // Import server action
import { getUnavailableDatesForProperty, createBooking, type CreateBookingData } from '@/services/bookingService'; // Import booking services


interface BookingFormProps {
  property: Property;
}


// Load Stripe outside component to avoid recreating on every render
// Ensure your Stripe publishable key is in an environment variable
const stripePromise = import('@stripe/stripe-js').then(m => m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''));

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe functionality will be limited.');
}


export function BookingForm({ property }: BookingFormProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [numberOfGuests, setNumberOfGuests] = useState(1); // Start with 1 guest
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [numberOfNights, setNumberOfNights] = useState(0);
  const [extraGuestCost, setExtraGuestCost] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for Stripe
  const [isTesting, setIsTesting] = useState(false); // Loading state for Test Booking
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]); // State for unavailable dates
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const { toast } = useToast();

  // Fetch unavailable dates when the component mounts or property changes
  useEffect(() => {
    async function fetchAvailability() {
      setIsLoadingAvailability(true);
      try {
        const unavailable = await getUnavailableDatesForProperty(property.id);
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
        setIsLoadingAvailability(false);
      }
    }

    fetchAvailability();
  }, [property.id, toast]); // Dependency array includes property.id and toast


  useEffect(() => {
    if (date?.from && date?.to && date.to > date.from) {
      const nights = differenceInDays(date.to, date.from);
      setNumberOfNights(nights);

      // Calculate extra guest cost
      const extraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);
      const calculatedExtraGuestCost = extraGuests * property.extraGuestFee * nights;
      setExtraGuestCost(calculatedExtraGuestCost);

      // Calculate total price
      const baseAccommodationCost = nights * property.pricePerNight;
      const calculatedPrice = baseAccommodationCost + calculatedExtraGuestCost + property.cleaningFee;
      setTotalPrice(calculatedPrice);

    } else {
      setNumberOfNights(0);
      setExtraGuestCost(0);
      setTotalPrice(null);
    }
  }, [date, numberOfGuests, property.pricePerNight, property.cleaningFee, property.baseOccupancy, property.extraGuestFee]);


  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      const newCount = prev + change;
      // Enforce limits: 1 to maxGuests
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };

   // Function to check if the selected date range is valid
   const isDateRangeValid = (): boolean => {
     if (!date?.from || !date?.to) {
       return false;
     }
     return date.to > date.from;
   };


  // --- Handle Stripe Checkout Submission ---
  const handleStripeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (!isDateRangeValid() || !totalPrice) {
       toast({
        title: "Error",
        description: "Please select valid check-in/check-out dates.",
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
      // 1. Call server action to create checkout session
      const checkoutInput = {
        property: property, // Pass the whole property or necessary details
        checkInDate: date.from!.toISOString(),
        checkOutDate: date.to!.toISOString(),
        numberOfGuests: numberOfGuests,
        totalPrice: totalPrice, // Pass the calculated total price
        numberOfNights: numberOfNights,
        // Add baseOccupancy and extraGuestFee for metadata if needed by webhook
        // baseOccupancy: property.baseOccupancy,
        // extraGuestFee: property.extraGuestFee,
      };
      const result = await createCheckoutSession(checkoutInput);


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
        console.error('❌ [BookingForm handleSubmit] Stripe redirect error:', error);
        toast({
          title: "Error Redirecting",
          description: error.message || "Could not redirect to Stripe.",
          variant: "destructive",
        });
         setIsSubmitting(false);
      }
    } catch (error) {
      console.error('❌ [BookingForm handleSubmit] Booking submission error:', error);
      toast({
        title: "Booking Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred during booking.",
        variant: "destructive",
      });
       setIsSubmitting(false);
    }
  };

   // --- Handle Test Booking Creation ---
   const handleTestBookingClick = async () => {
     setIsTesting(true);

     if (!isDateRangeValid() || !totalPrice) {
       toast({
         title: "Test Booking Error",
         description: "Please select valid check-in/check-out dates before creating a test booking.",
         variant: "destructive",
       });
       setIsTesting(false);
       return;
     }

     // Construct mock data using form state, including new pricing fields
     const extraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);
     const accommodationTotal = (property.pricePerNight * numberOfNights) + extraGuestCost;
     const subtotal = accommodationTotal + property.cleaningFee;

     const mockBookingData: CreateBookingData = {
       propertyId: property.id,
       guestInfo: {
         firstName: "Dev",
         lastName: "Tester",
         email: `dev.tester.${Date.now()}@example.com`, // Unique email
         userId: "dev-user-123",
         phone: "+15551112233", // Example phone
       },
       checkInDate: date.from!.toISOString(),
       checkOutDate: date.to!.toISOString(),
       numberOfGuests: numberOfGuests,
       pricing: {
         baseRate: property.pricePerNight,
         numberOfNights: numberOfNights,
         cleaningFee: property.cleaningFee,
         extraGuestFee: property.extraGuestFee, // Add extra fee
         numberOfExtraGuests: extraGuests,     // Add number of extra guests
         accommodationTotal: accommodationTotal, // Add accommodation total
         subtotal: subtotal,                   // Updated subtotal
         taxes: 0, // Assuming 0 tax for test
         total: totalPrice, // Final calculated total
       },
       paymentInput: {
         stripePaymentIntentId: `mock_test_${Date.now()}`, // Unique mock ID
         amount: totalPrice,
         status: "succeeded", // Simulate success
       },
       status: 'confirmed' as Booking['status'], // Directly set status
       source: 'test-button',
       notes: `Test booking created from form for ${numberOfGuests} guests.`,
     };

     try {
       const bookingId = await createBooking(mockBookingData);

       if (bookingId) {
         toast({
           title: "Test Booking Successful",
           description: `Test booking created in Firestore with ID: ${bookingId}`,
         });
         // Refresh availability after test booking
         const unavailable = await getUnavailableDatesForProperty(property.id);
         setUnavailableDates(unavailable);
         setDate(undefined); // Reset date after successful test booking
       } else {
         toast({
           title: "Test Booking Possibly Failed",
           description: "Booking creation completed but didn't return a valid ID.",
           variant: "destructive",
         });
       }
     } catch (error) {
       console.error("[TestBookingButton] Error creating test booking:", error);
       toast({
         title: "Test Booking Failed",
         description: error instanceof Error ? error.message : "An unknown error occurred.",
         variant: "destructive",
       });
     } finally {
       setIsTesting(false);
     }
   };


  const isButtonDisabled = !isDateRangeValid() || !totalPrice || isSubmitting || isTesting || isLoadingAvailability;

  return (
    <form onSubmit={handleStripeSubmit} className="space-y-6">
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
              disabled={isSubmitting || isTesting || isLoadingAvailability} // Disable while submitting or loading availability
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
              disabled={numberOfGuests <= 1 || isSubmitting || isTesting} // Disable while submitting/testing
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
              disabled={numberOfGuests >= property.maxGuests || isSubmitting || isTesting} // Disable while submitting/testing
              aria-label="Increase guests"
            >
              <Plus className="h-4 w-4" />
            </Button>
        </div>
         <p className="text-xs text-muted-foreground mt-1">
            Max {property.maxGuests} guests. Base price for {property.baseOccupancy}.
            {property.extraGuestFee > 0 && ` $${property.extraGuestFee}/extra guest/night.`}
          </p>
      </div>


      {/* Price Calculation */}
       {totalPrice !== null && numberOfNights > 0 && (
        <div className="space-y-2 text-sm">
          <Separator className="my-4" />
          {/* Base Accommodation Cost */}
          <div className="flex justify-between">
            <span>
              ${property.pricePerNight} x {numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'} (for {property.baseOccupancy} {property.baseOccupancy === 1 ? 'guest' : 'guests'})
            </span>
            <span>${(property.pricePerNight * numberOfNights).toFixed(2)}</span>
          </div>
           {/* Extra Guest Fees (if applicable) */}
           {extraGuestCost > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>
                Extra guest fee (${property.extraGuestFee}/guest/night x {Math.max(0, numberOfGuests - property.baseOccupancy)} guests x {numberOfNights} nights)
              </span>
              <span>${extraGuestCost.toFixed(2)}</span>
            </div>
          )}
          {/* Cleaning Fee */}
          <div className="flex justify-between">
            <span>Cleaning fee</span>
            <span>${property.cleaningFee.toFixed(2)}</span>
          </div>
           {/* Add other fees like service fee if applicable */}
          <Separator className="my-2" />
           {/* Total Price */}
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Stripe Payment Button */}
      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" // Use primary color
        disabled={isButtonDisabled}
        >
        {isSubmitting ? (
           <>
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             Processing...
           </>
         ) : isLoadingAvailability ? (
             'Loading Availability...'
         ) : (
           'Proceed to Payment'
         )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
         You will be redirected to Stripe to complete your payment.
      </p>

      {/* Test Booking Button (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <>
         <Separator className="my-4 border-dashed" />
          <Button
            type="button" // Important: Change type to 'button' to prevent form submission
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleTestBookingClick}
            disabled={isButtonDisabled}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Test...
              </>
            ) : (
              <>
                <TestTubeDiagonal className="mr-2 h-4 w-4" />
                Create Test Booking (Firestore Only)
              </>
            )}
          </Button>
           <p className="text-xs text-center text-muted-foreground mt-2">
             (Development only - Bypasses Stripe)
          </p>
        </>
      )}
    </form>
  );
}
