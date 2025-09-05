"use client";

import React, { useState, useEffect } from 'react';
import { addDays } from 'date-fns';
import { Check, Loader2, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GuestSelector } from '../common/GuestSelector';
import { SimpleDateSelector } from './SimpleDateSelector';

interface SimpleAvailabilityCheckerProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  numberOfNights: number;
  guestCount: number;
  maxGuests: number;
  onCheckInChange: (date: Date | null) => void;
  onCheckOutChange: (date: Date | null) => void;
  onGuestCountChange: (count: number) => void;
  onCheckAvailability: () => Promise<void>;
  isCheckingAvailability: boolean;
  wasChecked: boolean;
  isAvailable: boolean | null;
  propertyName: string;
}

/**
 * SimpleAvailabilityChecker component
 * 
 * Uses separate date fields for check-in and check-out for easier usability
 */
export function SimpleAvailabilityChecker({
  checkInDate,
  checkOutDate,
  numberOfNights,
  guestCount,
  maxGuests,
  onCheckInChange,
  onCheckOutChange,
  onGuestCountChange,
  onCheckAvailability,
  isCheckingAvailability,
  wasChecked,
  isAvailable,
  propertyName
}: SimpleAvailabilityCheckerProps) {
  // Create a derived value for min checkout date (always day after check-in)
  const minCheckoutDate = checkInDate ? addDays(checkInDate, 1) : new Date();

  // Auto-update checkout date when check-in date changes
  useEffect(() => {
    if (checkInDate) {
      // Always clear checkout date when check-in date changes
      // This allows user to select a fresh checkout date
      onCheckOutChange(null);
    }
  }, [checkInDate, onCheckOutChange]);

  // Auto-check availability when both dates are selected
  useEffect(() => {
    // Only auto-check when both dates are selected and not already checking
    if (checkInDate && checkOutDate && !isCheckingAvailability) {
      // Small timeout to avoid rapid rechecks during date selection
      const timer = setTimeout(() => {
        console.log('[SimpleAvailabilityChecker] Auto-checking availability');
        onCheckAvailability();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [checkInDate, checkOutDate, isCheckingAvailability, onCheckAvailability]);

  return (
    <div className="p-4 border border-blue-200 bg-blue-50 rounded-md">
      <h3 className="font-medium text-blue-800">Availability Checker</h3>
      <p className="text-sm text-blue-700 mb-4">
        Select your dates and check availability.
      </p>

      <div className="flex items-center space-x-2 bg-white p-3 rounded shadow-sm">
        <Calendar className="h-4 w-4 text-blue-600" />
        <p>Property: {propertyName}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Simple Date Selectors */}
        <SimpleDateSelector 
          date={checkInDate}
          onChange={onCheckInChange}
          label="Check-in Date"
          placeholder="Select check-in date"
          disabled={isCheckingAvailability}
        />

        <SimpleDateSelector 
          date={checkOutDate}
          onChange={onCheckOutChange}
          label="Check-out Date"
          placeholder="Select check-out date"
          disabled={isCheckingAvailability}
          minDate={minCheckoutDate}
        />
      </div>

      {/* Show nights count when both dates are selected */}
      {checkInDate && checkOutDate && numberOfNights > 0 && (
        <p className="text-sm text-blue-800 mt-2">
          Total stay: {numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'}
        </p>
      )}

      {/* Guest Count Selector */}
      <div className="mt-4">
        <GuestSelector
          maxGuests={maxGuests}
          disabled={isCheckingAvailability}
        />
      </div>

      {/* Only show a warning if dates are not available */}
      {wasChecked && isAvailable === false && (
        <div className="mt-4 bg-red-100 p-3 rounded shadow-sm flex items-center">
          <X className="h-4 w-4 text-red-600 mr-2" />
          <p className="text-sm text-red-800">These dates are not available.</p>
        </div>
      )}

    </div>
  );
}