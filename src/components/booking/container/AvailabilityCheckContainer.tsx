"use client";

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
import { Button } from '@/components/ui/button';
import { BookingOptionsCards } from '../booking-options-cards';
import { BookingSummary } from '../booking-summary';
import { AvailabilityStatus } from '../availability-status';
import { DebugPanel, FixNights } from '../utilities';
import { DateSelection, GuestCountSelector } from '../features';
import { ContactHostForm } from '../forms';
import { useAvailabilityCheck, useDateCalculation, usePriceCalculation, useBookingForm } from '../hooks';
import type { Property } from '@/types';

interface AvailabilityCheckContainerProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

/**
 * Main container component for availability checking and booking
 */
export function AvailabilityCheckContainer({
  property,
  initialCheckIn,
  initialCheckOut
}: AvailabilityCheckContainerProps) {
  // Get values from booking context
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    propertySlug
  } = useBooking();
  
  // Track if component has mounted
  const [hasMounted, setHasMounted] = useState(false);
  
  // Set mounted flag on first render
  React.useEffect(() => {
    setHasMounted(true);
    
    // Log props for debugging
    console.log('[AvailabilityCheckContainer] Initializing with props:', {
      propertySlug: property.slug,
      initialCheckIn,
      initialCheckOut
    });
  }, [initialCheckIn, initialCheckOut, property.slug]);
  
  // Custom hooks for functionality
  const { recalculateNights } = useDateCalculation();
  const { 
    isAvailable, 
    isLoadingAvailability, 
    unavailableDates, 
    suggestedDates, 
    checkAvailability, 
    setIsAvailable 
  } = useAvailabilityCheck(property.slug);
  const { 
    pricingDetails, 
    appliedCoupon, 
    applyCoupon, 
    removeCoupon,
    propertyBaseCcy,
    selectedCurrency
  } = usePriceCalculation(property);
  const {
    isProcessingBooking,
    isPending,
    formError,
    lastErrorType,
    canRetryError,
    selectedOption,
    setSelectedOption,
    handleContinueToPayment,
    handleHoldDates,
    onInquirySubmit
  } = useBookingForm(property);
  
  // Check if dates are selected
  const datesSelected = !!checkInDate && !!checkOutDate;
  
  // Handler for alternative date selection
  const handleSelectAlternativeDate = (range: { from: Date; to: Date }) => {
    // To be implemented when we add the alternative dates feature
  };
  
  // Show loading state while initial render is happening
  if (!hasMounted) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading booking options...</p>
      </div>
    );
  }
  
  // Force availability in development mode
  const forceAvailable = () => {
    console.log('[AvailabilityCheckContainer] Forcing availability to true');
    setIsAvailable(true);
    
    // Also ensure we have a night count
    if (!numberOfNights || numberOfNights <= 0) {
      recalculateNights();
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
      {/* Helper component to fix nights calculation */}
      <FixNights />
      
      {/* Debug panel in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <DebugPanel 
          isAvailable={isAvailable}
          isLoadingAvailability={isLoadingAvailability}
          checkAvailability={checkAvailability}
          forceAvailable={forceAvailable}
          selectedOption={selectedOption}
        />
      )}
      
      {/* Availability status */}
      <AvailabilityStatus
        isLoadingAvailability={isLoadingAvailability}
        isAvailable={isAvailable}
        datesSelected={datesSelected}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        numberOfNights={numberOfNights}
        suggestedDates={suggestedDates}
        unavailableDates={unavailableDates}
        handleSelectAlternativeDate={handleSelectAlternativeDate}
        propertySlug={propertySlug}
        email={''} // These will be handled by the forms directly
        setEmail={() => {}} // These will be handled by the forms directly
        phone={''} // These will be handled by the forms directly
        setPhone={() => {}} // These will be handled by the forms directly
        isProcessingBooking={isProcessingBooking || isPending}
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
            disabled={isProcessingBooking || isLoadingAvailability} 
          />
        </div>
        <div className="md:w-auto md:shrink-0">
          <GuestCountSelector 
            property={property} 
            disabled={isProcessingBooking} 
          />
        </div>
      </div>
      
      {/* Booking information if available */}
      {isAvailable === true && !isLoadingAvailability && datesSelected && (
        <div className="mt-8 space-y-6">
          {/* Pricing summary */}
          <BookingSummary
            numberOfNights={numberOfNights}
            numberOfGuests={property.baseOccupancy}
            pricingDetails={pricingDetails}
            propertyBaseCcy={propertyBaseCcy}
            appliedCoupon={appliedCoupon}
          />
          
          {/* Booking options */}
          <BookingOptionsCards
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            property={property}
          />
          
          {/* Contact host form */}
          {selectedOption === 'contact' && (
            <ContactHostForm
              onSubmit={onInquirySubmit}
              isProcessing={isProcessingBooking}
              isPending={isPending}
              pricingDetails={pricingDetails}
              selectedCurrency={selectedCurrency}
            />
          )}
          
          {/* Other booking forms will go here */}
          {/* Hold dates form */}
          {/* Book now form */}
        </div>
      )}
    </div>
  );
}