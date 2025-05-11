"use client";

import React, { useState, useEffect } from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';

/**
 * Debug component to show the current date state
 * Only rendered in development mode
 */
export function DebugDates() {
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    propertySlug,
    numberOfGuests
  } = useBooking();

  const searchParams = useSearchParams();

  // Track if component is mounted
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !mounted) {
    return null;
  }

  return (
    <div className="fixed top-0 right-0 p-2 bg-black/80 text-xs text-white z-50 max-w-xs overflow-auto max-h-screen">
      <h4 className="font-bold">Debug Info</h4>
      <pre>
        propertySlug: {propertySlug || 'null'}<br />
        checkInDate: {checkInDate ? format(checkInDate, 'yyyy-MM-dd') : 'null'}<br />
        checkOutDate: {checkOutDate ? format(checkOutDate, 'yyyy-MM-dd') : 'null'}<br />
        datesSelected: {!!(checkInDate && checkOutDate) + ''}<br />
        numberOfNights: {numberOfNights}<br />
        numberOfGuests: {numberOfGuests}<br />
        <br />
        URL Parameters:<br />
        checkIn: {searchParams.get('checkIn') || 'null'}<br />
        checkOut: {searchParams.get('checkOut') || 'null'}<br />
      </pre>

      <button
        onClick={() => {
          if (typeof window !== 'undefined') {
            console.log('All session storage items:');
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              const value = sessionStorage.getItem(key || '');
              console.log(`${key}: ${value}`);
            }
          }
        }}
        className="mt-2 text-xs bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded"
      >
        Log Storage to Console
      </button>
    </div>
  );
}