"use client"; // Required for form handling and state

import * as React from 'react';
import { useState, useEffect } from 'react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Users, Minus, Plus } from 'lucide-react';
import { DateRange } from 'react-day-picker';

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

interface BookingFormProps {
  property: Property;
  // In a real app, you'd likely pass unavailable dates here
  // unavailableDates?: Date[];
}

// Mock unavailable dates for demonstration
const mockUnavailableDates = [
  addDays(new Date(), 5),
  addDays(new Date(), 6),
  addDays(new Date(), 10),
  addDays(new Date(), 11),
  addDays(new Date(), 12),
];

export function BookingForm({ property }: BookingFormProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [numberOfNights, setNumberOfNights] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (date?.from && date?.to) {
      const nights = differenceInDays(date.to, date.from);
      setNumberOfNights(nights);
      if (nights > 0) {
        const calculatedPrice = nights * property.pricePerNight + property.cleaningFee;
        setTotalPrice(calculatedPrice);
      } else {
        setTotalPrice(null); // Reset price if dates are invalid or same day
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!date?.from || !date?.to) {
       toast({
        title: "Error",
        description: "Please select check-in and check-out dates.",
        variant: "destructive",
      });
      return;
    }

    if (numberOfNights <= 0) {
       toast({
        title: "Error",
        description: "Check-out date must be after check-in date.",
        variant: "destructive",
      });
      return;
    }

    console.log('Booking submitted:', {
      propertyId: property.id,
      checkInDate: date.from,
      checkOutDate: date.to,
      numberOfGuests,
      totalPrice,
    });

    // TODO: Implement actual booking logic (e.g., call API, Stripe integration)
    // Redirect to a confirmation page or show success message
    toast({
      title: "Booking Request Submitted (Demo)",
      description: `Booking for ${property.name} from ${format(date.from, 'LLL dd, y')} to ${format(date.to, 'LLL dd, y')} for ${numberOfGuests} guests. Total: $${totalPrice?.toFixed(2)}`,
    });

    // Reset form after submission (optional)
    // setDate(undefined);
    // setNumberOfGuests(1);
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
              disabled={numberOfGuests <= 1}
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
              disabled={numberOfGuests >= property.maxGuests}
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
              ${property.pricePerNight} x {numberOfNights} nights
            </span>
            <span>${(property.pricePerNight * numberOfNights).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cleaning fee</span>
            <span>${property.cleaningFee.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!date?.from || !date?.to || numberOfNights <= 0}>
        Request to Book
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        You won't be charged yet
      </p>
    </form>
  );
}
