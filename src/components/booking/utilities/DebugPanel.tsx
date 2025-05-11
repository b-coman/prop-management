"use client";

import React from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { useDateCalculation } from '../hooks/useDateCalculation';

interface DebugPanelProps {
  isAvailable: boolean | null;
  isLoadingAvailability: boolean;
  checkAvailability: () => void;
  forceAvailable?: () => void;
  selectedOption: string | null;
}

/**
 * Debug panel component that shows current state and debugging controls
 * Only visible in development mode
 */
export function DebugPanel({
  isAvailable,
  isLoadingAvailability,
  checkAvailability,
  forceAvailable,
  selectedOption
}: DebugPanelProps) {
  // Get values from booking context
  const {
    propertySlug,
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests
  } = useBooking();

  // Get date calculation utilities
  const { recalculateNights } = useDateCalculation();

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
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
          {forceAvailable && (
            <button
              onClick={() => forceAvailable()}
              className="text-xs bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded mr-2"
            >
              Force Available
            </button>
          )}

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
  );
}