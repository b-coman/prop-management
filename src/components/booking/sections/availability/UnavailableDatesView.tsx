"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { DateAlternatives } from './DateAlternatives';
import { useDateSuggestions } from '../../hooks/useDateSuggestions';
import { ContactHostForm } from '../forms/ContactHostForm';
import type { DateAlternative } from './DateAlternatives';

interface UnavailableDatesViewProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  numberOfNights: number;
  selectedOption: 'contact' | 'hold' | 'bookNow' | null;
  setSelectedOption: (option: 'contact' | 'hold' | 'bookNow' | null) => void;
  onInquirySubmit: (values: any) => Promise<void>;
  isProcessingBooking: boolean;
  isPending: boolean;
  selectAndCheckDates: (newCheckIn: Date, newCheckOut: Date) => Promise<void>;
  selectedCurrency: string;
  unavailableDates: Date[];
  property: any;
}

/**
 * UnavailableDatesView component
 * 
 * This component shows a view when selected dates are unavailable, 
 * including alternative date suggestions, a calendar, and a contact form.
 */
export function UnavailableDatesView({
  checkInDate,
  checkOutDate,
  numberOfNights,
  selectedOption,
  setSelectedOption,
  onInquirySubmit,
  isProcessingBooking,
  isPending,
  selectAndCheckDates,
  selectedCurrency,
  unavailableDates = [],
  property
}: UnavailableDatesViewProps) {
  // Get date suggestions using the custom hook
  const dateAlternatives = useDateSuggestions({
    checkInDate,
    checkOutDate,
    numberOfNights
  });
  
  // Handler for selecting an alternative date
  const handleSelectAlternative = async (alternative: DateAlternative) => {
    await selectAndCheckDates(alternative.checkIn, alternative.checkOut);
  };
  
  // Handler for clicking on a date in the calendar
  const handleCalendarDateClick = (date: Date) => {
    if (!date || isProcessingBooking) return;
    
    // Calculate an appropriate checkout date based on the selected date
    const newCheckoutDate = new Date(date);
    newCheckoutDate.setDate(date.getDate() + (numberOfNights > 0 ? numberOfNights : 2));
    
    // Update dates and check availability
    selectAndCheckDates(date, newCheckoutDate);
  };
  
  return (
    <div className="space-y-6">
      
      {/* Alternative dates suggestions */}
      <DateAlternatives 
        alternatives={dateAlternatives}
        onSelectAlternative={handleSelectAlternative}
        isProcessing={isProcessingBooking}
      />
      
      {/* Calendar showing available dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Dates</CardTitle>
          <CardDescription>
            Green dates are available. Explore the calendar to find your perfect stay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvailabilityCalendar 
            currentMonth={checkInDate || new Date()}
            unavailableDates={unavailableDates}
            selectedRange={{ from: checkInDate || undefined, to: checkOutDate || undefined }}
            onDateClick={handleCalendarDateClick}
          />
        </CardContent>
      </Card>
      
      {/* Contact host option */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
          <CardDescription>
            The host might be able to accommodate special requests or suggest alternatives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setSelectedOption('contact')}
            className="w-full md:w-auto"
            disabled={isProcessingBooking}
          >
            Contact Host
          </Button>
          
          {selectedOption === 'contact' && (
            <div className="mt-6">
              <ContactHostForm
                onSubmit={onInquirySubmit}
                isProcessing={isProcessingBooking}
                isPending={isPending}
                pricingDetails={null} // No pricing when dates unavailable
                selectedCurrency={selectedCurrency}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}