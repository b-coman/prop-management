"use client";

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ContactHostForm } from '../forms/ContactHostForm';
import { AvailabilityCalendar } from '../sections/availability/AvailabilityCalendar';
import { Loader2 } from 'lucide-react';

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
}

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
  selectedCurrency
}: UnavailableDatesViewProps) {
  // Local state to track which suggestion is being processed
  const [processingOption, setProcessingOption] = useState<string | null>(null);
  
  // Helper for showing which option is being processed
  const isProcessing = (optionId: string) => {
    return isProcessingBooking && processingOption === optionId;
  };

  // Helper to handle clicks on suggestion buttons
  const handleSelectDates = async (newCheckIn: Date, newCheckOut: Date, optionId: string) => {
    try {
      setProcessingOption(optionId);
      await selectAndCheckDates(newCheckIn, newCheckOut);
    } finally {
      setProcessingOption(null);
    }
  };

  // Helper to calculate weekends
  const nextFriday = (date: Date): Date => {
    const result = new Date(date);
    const currentDay = result.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToAdd = currentDay <= 5 ? 5 - currentDay : 5 + (7 - currentDay);
    result.setDate(result.getDate() + daysToAdd);
    return result;
  };

  const nextSunday = (date: Date): Date => {
    const friday = nextFriday(date);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    return sunday;
  };

  return (
    <div className="space-y-6">
      
      {/* Alternative dates suggestions */}
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-lg text-amber-900">Alternative Dates</CardTitle>
          <CardDescription className="text-amber-800">
            The following dates are available options:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* First suggestion: 1 week later, same number of nights */}
          {checkInDate && checkOutDate && (
            <Button
              variant="outline"
              className="w-full justify-between bg-white hover:bg-gray-50 border-gray-300"
              onClick={() => {
                if (isProcessingBooking) return;
                
                // Calculate dates one week later
                const oneWeekLater = new Date(checkInDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                const oneWeekLaterCheckout = new Date(checkOutDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                
                // Update and check in one go
                handleSelectDates(oneWeekLater, oneWeekLaterCheckout, 'week-later');
              }}
              disabled={isProcessingBooking}
            >
              {isProcessing('week-later') ? (
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Checking availability...</span>
                </div>
              ) : (
                <>
                  <span>
                    {checkInDate && format(new Date(checkInDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')} - {checkOutDate && format(new Date(checkOutDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')} ({numberOfNights} nights)
                  </span>
                  <Badge variant="secondary">1 week later</Badge>
                </>
              )}
            </Button>
          )}
          
          {/* Second suggestion: 1 month later, same number of nights */}
          {checkInDate && checkOutDate && (
            <Button
              variant="outline"
              className="w-full justify-between bg-white hover:bg-gray-50 border-gray-300"
              onClick={() => {
                if (isProcessingBooking) return;
                
                // Calculate dates one month later
                const oneMonthLater = new Date(checkInDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                const oneMonthLaterCheckout = new Date(checkOutDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                
                // Update and check in one go
                handleSelectDates(oneMonthLater, oneMonthLaterCheckout, 'month-later');
              }}
              disabled={isProcessingBooking}
            >
              {isProcessing('month-later') ? (
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Checking availability...</span>
                </div>
              ) : (
                <>
                  <span>
                    {checkInDate && format(new Date(checkInDate.getTime() + 30 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')} - {checkOutDate && format(new Date(checkOutDate.getTime() + 30 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')} ({numberOfNights} nights)
                  </span>
                  <Badge variant="secondary">Next month</Badge>
                </>
              )}
            </Button>
          )}
          
          {/* Third suggestion: same dates, shorter stay */}
          {checkInDate && checkOutDate && numberOfNights > 3 && (
            <Button
              variant="outline"
              className="w-full justify-between bg-white hover:bg-gray-50 border-gray-300"
              onClick={() => {
                if (isProcessingBooking) return;
                
                // Calculate a shorter stay (3 nights from check-in)
                const shorterStayCheckout = new Date(checkInDate.getTime() + 3 * 24 * 60 * 60 * 1000);
                
                // Update and check in one go
                handleSelectDates(checkInDate, shorterStayCheckout, 'shorter-stay');
              }}
              disabled={isProcessingBooking}
            >
              {isProcessing('shorter-stay') ? (
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Checking availability...</span>
                </div>
              ) : (
                <>
                  <span>
                    {checkInDate && format(checkInDate, 'MMM d, yyyy')} - {checkInDate && format(new Date(checkInDate.getTime() + 3 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')} (3 nights)
                  </span>
                  <Badge variant="secondary">Shorter stay</Badge>
                </>
              )}
            </Button>
          )}
          
          {/* Fourth suggestion: weekend option */}
          {checkInDate && (
            <Button
              variant="outline"
              className="w-full justify-between bg-white hover:bg-gray-50 border-gray-300"
              onClick={() => {
                if (isProcessingBooking) return;
                
                // Calculate weekend dates
                const fridayDate = nextFriday(checkInDate);
                const sundayDate = nextSunday(checkInDate);
                
                // Update and check in one go
                handleSelectDates(fridayDate, sundayDate, 'weekend');
              }}
              disabled={isProcessingBooking}
            >
              {isProcessing('weekend') ? (
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Checking availability...</span>
                </div>
              ) : (
                <>
                  <span>
                    {checkInDate && format(nextFriday(checkInDate), 'MMM d, yyyy')} - {checkInDate && format(nextSunday(checkInDate), 'MMM d, yyyy')} (2 nights)
                  </span>
                  <Badge variant="secondary">Weekend stay</Badge>
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
      
      {/* Calendar showing available dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Dates</CardTitle>
          <CardDescription>
            Green dates are available. Explore the calendar to find your perfect stay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Using the AvailabilityCalendar component */}
          <AvailabilityCalendar 
            currentMonth={checkInDate || new Date()}
            unavailableDates={[
              // Mock unavailable dates for demonstration
              // In real implementation, these would come from your availability service
              new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000),
              new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000),
              new Date(new Date().getTime() + 4 * 24 * 60 * 60 * 1000),
              new Date(new Date().getTime() + 12 * 24 * 60 * 60 * 1000),
              new Date(new Date().getTime() + 13 * 24 * 60 * 60 * 1000),
              new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000),
              // Add more as needed
            ]}
            selectedRange={{ from: checkInDate, to: checkOutDate }}
            onDateClick={(date) => {
              if (!date || isProcessingBooking) return;
              
              // If we have a valid date, calculate a default checkout (check-in + same number of nights)
              const newCheckoutDate = new Date(date);
              newCheckoutDate.setDate(date.getDate() + (numberOfNights > 0 ? numberOfNights : 2));
              
              // Update and check in one go
              handleSelectDates(date, newCheckoutDate, 'calendar');
            }}
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