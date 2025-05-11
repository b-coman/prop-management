"use client";

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookingOptionsCards } from '../booking-options-cards';
import { BookingSummary } from '../booking-summary';
import { AvailabilityStatus } from '../availability-status';
import { FixNights } from '../fix-nights';
import { DateSelection, GuestCountSelector } from '../features';
import { useDateCalculation } from '../hooks/useDateCalculation';
import { parseDateSafe } from '../date-utils';
import type { Property } from '@/types';

interface RefactoredAvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

/**
 * Simplified version of the availability check component that works with the existing page structure
 */
export function RefactoredAvailabilityCheck({
  property,
  initialCheckIn,
  initialCheckOut
}: RefactoredAvailabilityCheckProps) {
  // Get values from booking context
  const {
    checkInDate, setCheckInDate,
    checkOutDate, setCheckOutDate,
    numberOfNights, setNumberOfNights,
    numberOfGuests, setNumberOfGuests,
    propertySlug, setPropertySlug
  } = useBooking();
  
  // UI state
  const [hasMounted, setHasMounted] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'contact' | 'hold' | 'bookNow' | null>(null);
  
  // Get date calculation utilities
  const { recalculateNights } = useDateCalculation();
  
  // Set mounted flag on first render
  useEffect(() => {
    setHasMounted(true);
    
    // Set property slug
    setPropertySlug(property.slug);
    
    // Initialize dates from URL parameters
    if (initialCheckIn || initialCheckOut) {
      console.log("Found URL params, processing dates");
      
      // Parse dates
      const parsedCheckIn = initialCheckIn ? parseDateSafe(initialCheckIn, 'RefactoredAvailabilityCheck') : null;
      const parsedCheckOut = initialCheckOut ? parseDateSafe(initialCheckOut, 'RefactoredAvailabilityCheck') : null;
      
      console.log('Parsed dates from URL:', {
        checkIn: parsedCheckIn ? parsedCheckIn.toISOString() : 'null',
        checkOut: parsedCheckOut ? parsedCheckOut.toISOString() : 'null'
      });
      
      // Set dates
      if (parsedCheckIn) setCheckInDate(parsedCheckIn);
      if (parsedCheckOut) setCheckOutDate(parsedCheckOut);
      
      // Calculate nights (if not already done)
      setTimeout(() => {
        if (parsedCheckIn && parsedCheckOut && (!numberOfNights || numberOfNights <= 0)) {
          // Calculate nights using milliseconds (most reliable)
          const daysDiff = Math.ceil((parsedCheckOut.getTime() - parsedCheckIn.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff > 0) {
            console.log(`Setting night count to ${daysDiff}`);
            setNumberOfNights(daysDiff);
          }
        }
      }, 500);
    }
    
    // Set guest count if not already set
    if (!numberOfGuests || numberOfGuests <= 0) {
      setNumberOfGuests(property.baseOccupancy || 1);
    }
    
    // Set availability to true for testing
    if (process.env.NODE_ENV === 'development') {
      setIsAvailable(true);
    }
  }, [initialCheckIn, initialCheckOut, setCheckInDate, setCheckOutDate, setPropertySlug, 
       property.slug, property.baseOccupancy, numberOfNights, setNumberOfNights, 
       numberOfGuests, setNumberOfGuests]);
  
  // Check if dates are selected
  const datesSelected = !!checkInDate && !!checkOutDate;
  
  // Return loading indicator if not mounted
  if (!hasMounted) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading booking options...</p>
      </div>
    );
  }
  
  // Simple forced availability check (for demo purposes)
  const checkAvailability = () => {
    setIsLoadingAvailability(true);
    
    // Simulate API call with a delay
    setTimeout(() => {
      setIsAvailable(true);
      setIsLoadingAvailability(false);
      
      // Make sure nights are calculated
      if (checkInDate && checkOutDate && (!numberOfNights || numberOfNights <= 0)) {
        recalculateNights();
      }
    }, 1500);
  };
  
  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
      {/* Helper component to fix nights calculation */}
      <FixNights />
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 bg-gray-100 p-3 rounded-md text-xs">
          <details open>
            <summary className="cursor-pointer font-medium text-blue-600">Debug Info</summary>
            <pre className="mt-2 whitespace-pre-wrap">
              propertySlug: {propertySlug || 'null'}
              checkInDate: {checkInDate ? checkInDate.toISOString() : 'null'}
              checkOutDate: {checkOutDate ? checkOutDate.toISOString() : 'null'}
              datesSelected: {!!(checkInDate && checkOutDate) + ''}
              isAvailable: {String(isAvailable)}
              isLoadingAvailability: {String(isLoadingAvailability)}
              numberOfNights: {numberOfNights}
              numberOfGuests: {numberOfGuests}
              selectedOption: {selectedOption || 'null'}
            </pre>

            <div className="mt-2 pt-2 border-t border-gray-300">
              <button
                onClick={() => setIsAvailable(true)}
                className="text-xs bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded mr-2"
              >
                Force Available
              </button>

              <button
                onClick={checkAvailability}
                className="text-xs bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded mr-2"
              >
                Check Availability
              </button>

              <button
                onClick={recalculateNights}
                className="text-xs bg-yellow-500 hover:bg-yellow-700 text-white py-1 px-2 rounded"
              >
                Fix Nights
              </button>
            </div>
          </details>
        </div>
      )}
      
      {/* Availability status (reusing the original) */}
      <AvailabilityStatus
        isLoadingAvailability={isLoadingAvailability}
        isAvailable={isAvailable}
        datesSelected={datesSelected}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        numberOfNights={numberOfNights}
        suggestedDates={[]}
        unavailableDates={[]}
        handleSelectAlternativeDate={() => {}}
        propertySlug={propertySlug}
        email={''}
        setEmail={() => {}}
        phone={''}
        setPhone={() => {}}
        isProcessingBooking={false}
      />
      
      {/* Check availability button */}
      {datesSelected && !isLoadingAvailability && (
        <div className="mt-6">
          <Button
            onClick={checkAvailability}
            className="w-full"
            variant="default"
            disabled={isLoadingAvailability}
          >
            {isAvailable === null ? "Check Availability for Selected Dates" : "Re-Check Availability"}
          </Button>
        </div>
      )}
      
      {/* Date and guest selection */}
      <div className="mt-6 flex flex-col md:flex-row md:items-end md:gap-4 space-y-4 md:space-y-0">
        <div className="flex-grow">
          <DateSelection 
            disabled={isLoadingAvailability} 
          />
        </div>
        <div className="md:w-auto md:shrink-0">
          <GuestCountSelector 
            property={property} 
            disabled={isLoadingAvailability} 
          />
        </div>
      </div>
      
      {/* Booking information if available */}
      {isAvailable === true && !isLoadingAvailability && datesSelected && (
        <div className="mt-8 space-y-6">
          {/* Pricing summary (simplified) */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Booking Summary</h3>
            <p>{numberOfNights} nights, {numberOfGuests} guests</p>
            <p className="text-lg font-bold mt-2">
              Total: €{property.pricePerNight * numberOfNights}
            </p>
          </div>
          
          {/* Booking options */}
          <BookingOptionsCards
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            property={property}
          />
          
          {/* Contact host form */}
          {selectedOption === 'contact' && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Contact Host (Simplified)</CardTitle></CardHeader>
              <CardContent>
                <p>
                  This is a simplified version of the contact form.<br/>
                  In the full implementation, this would be a real form.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}