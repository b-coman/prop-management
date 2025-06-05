"use client";

import React, { useState, useEffect } from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { debugSession } from '@/hooks/debugUtils';
import { format } from 'date-fns';

// Only shown in development
export function DebugBooking() {
  const [visible, setVisible] = useState(false);
  const booking = useBooking();
  const [sessionData, setSessionData] = useState<Record<string, any>>({});

  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return;
    
    // Debug session storage
    const data = debugSession('booking_');
    setSessionData(data);
  }, [booking]);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-0 right-0 bg-black/80 text-white p-2 z-50 max-w-lg text-xs">
      <button 
        onClick={() => setVisible(!visible)}
        className="underline"
      >
        {visible ? 'Hide' : 'Show'} Booking Debug
      </button>
      
      {visible && (
        <div className="mt-2 overflow-auto max-h-[300px]">
          <div>
            <h4 className="font-bold">Booking Context State:</h4>
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify({
                ...booking,
                checkInDate: booking.checkInDate ? formatDate(booking.checkInDate) : null,
                checkOutDate: booking.checkOutDate ? formatDate(booking.checkOutDate) : null
              }, null, 2)}
            </pre>
          </div>
          
          <div className="mt-2">
            <h4 className="font-bold">SessionStorage:</h4>
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(sessionData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  try {
    return `${format(date, 'yyyy-MM-dd')} (${date.toISOString()})`;
  } catch (e) {
    return `Invalid date: ${date}`;
  }
}