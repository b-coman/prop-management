"use client";

import React from 'react';
import { format } from 'date-fns';
import { Calendar, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GuestSelector } from '../common/GuestSelector';
import { CustomDateRangePicker } from '../../CustomDateRangePicker';

interface AvailabilityCheckerProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  numberOfNights: number;
  guestCount: number;
  maxGuests: number;
  onGuestCountChange: (count: number) => void;
  onDateChange?: (from: Date | null, to: Date | null) => void;
  onCheckAvailability: () => Promise<void>;
  isCheckingAvailability: boolean;
  wasChecked: boolean;
  isAvailable: boolean | null;
  propertyName: string;
}

/**
 * AvailabilityChecker component
 * 
 * This component provides the UI for selecting dates and guests,
 * and checking availability for a property.
 */
export function AvailabilityChecker({
  checkInDate,
  checkOutDate,
  numberOfNights,
  guestCount,
  maxGuests,
  onGuestCountChange,
  onDateChange,
  onCheckAvailability,
  isCheckingAvailability,
  wasChecked,
  isAvailable,
  propertyName
}: AvailabilityCheckerProps) {
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

      <div className="mt-6 flex flex-col md:flex-row md:items-end md:gap-4 space-y-4 md:space-y-0">
        {/* Use our custom DateRangePicker component */}
        <div className="flex-grow">
          <CustomDateRangePicker
            checkInDate={checkInDate}
            checkOutDate={checkOutDate}
            onDateChange={(from, to) => {
              if (onDateChange) {
                onDateChange(from, to);
              }
            }}
            numberOfNights={numberOfNights}
            disabled={isCheckingAvailability}
            showNights={true}
          />
        </div>

        {/* Guest Count Selector */}
        <GuestSelector
          maxGuests={maxGuests}
          disabled={isCheckingAvailability}
          className="md:w-auto md:shrink-0"
        />
      </div>

      {/* Availability Status Message */}
      {wasChecked && isAvailable !== null && (
        <div className={`mt-3 ${isAvailable ? 'bg-green-100' : 'bg-red-100'} p-3 rounded shadow-sm flex items-center`}>
          {isAvailable ? (
            <>
              <Check className="h-4 w-4 text-green-600 mr-2" />
              <p className="text-sm text-green-800">These dates are available!</p>
            </>
          ) : (
            <>
              <X className="h-4 w-4 text-red-600 mr-2" />
              <p className="text-sm text-red-800">These dates are not available.</p>
            </>
          )}
        </div>
      )}

      {/* Check Availability Button */}
      {checkInDate && checkOutDate && (
        <div className="mt-4">
          <Button
            onClick={onCheckAvailability}
            disabled={isCheckingAvailability || !checkInDate || !checkOutDate}
            className="w-full"
          >
            {isCheckingAvailability ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              wasChecked ? 'Re-check Availability' : 'Check Availability'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}