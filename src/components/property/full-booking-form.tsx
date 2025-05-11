// src/components/property/full-booking-form.tsx
"use client";

import { useEffect, useState } from 'react';
import { FullBookingFormBlock } from '@/lib/overridesSchemas-multipage';
import { AvailabilityCheck } from '@/components/booking/availability-check';
import { Property } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarX } from 'lucide-react';

interface FullBookingFormProps {
  content: FullBookingFormBlock;
  property?: Property; // The property object would be passed from the parent component
}

export function FullBookingForm({ content, property }: FullBookingFormProps) {
  // Ensure content is valid with defaults
  if (!content) {
    console.warn("FullBookingForm received invalid content");
    return null;
  }

  const { 
    title = "Book Your Stay", 
    description = "Check availability and book your stay with us", 
    showCalendar = true, 
    showSummary = true, 
    enableCoupons = false 
  } = content;

  const [isClient, setIsClient] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Set isClient when component mounts
  useEffect(() => {
    setIsClient(true);

    // Scroll to the booking section after component mounts
    const bookingElement = document.getElementById('booking-section');
    if (bookingElement) {
      bookingElement.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Handle errors in availability check component
  useEffect(() => {
    if (isClient && !property) {
      // Set error after a timeout to avoid flashing error message during normal loading
      const timer = setTimeout(() => {
        setHasError(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isClient, property]);

  return (
    <section className="py-16 bg-background" id="booking-section">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        
        <div className="max-w-4xl mx-auto">
          {isClient ? (
            <>
              {property ? (
                <AvailabilityCheck 
                  property={property} 
                  showCalendar={showCalendar}
                  showSummary={showSummary}
                  enableCoupons={enableCoupons}
                />
              ) : hasError ? (
                <Alert variant="destructive" className="mb-6">
                  <CalendarX className="h-4 w-4 mr-2" />
                  <AlertDescription>
                    Unable to load booking information. Please refresh the page or contact us directly to book.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="p-8 border rounded-lg text-center animate-pulse">
                  <p className="text-muted-foreground mb-4">
                    Loading booking information...
                  </p>
                  <p className="text-sm">
                    Please wait while we check availability for this property.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 border rounded-lg text-center">
              <p className="text-muted-foreground">
                Booking calendar will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}