"use client";

import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { BookingProvider, useBooking } from '@/contexts/BookingContext';
import { AvailabilityContainer } from './AvailabilityContainer';
import type { Property } from '@/types';

interface BookingContainerProps {
  property: Property;
}

/**
 * Inner component that accesses the BookingContext
 */
function BookingInitializer({
  property,
  initialCheckIn,
  initialCheckOut,
  initialGuests
}: {
  property: Property;
  initialCheckIn?: Date;
  initialCheckOut?: Date;
  initialGuests?: number;
}) {
  const {
    setPropertySlug,
    setCheckInDate,
    setCheckOutDate,
    setNumberOfGuests,
    setNumberOfNights
  } = useBooking();
  
  // Define ref outside the effect hook
  const hasInitialized = useRef(false);

  // Initialize booking context with URL parameters - once only
  useEffect(() => {
    // Skip if already initialized
    if (hasInitialized.current) {
      console.log("ℹ️ [CLIENT] BookingInitializer already ran - skipping initialization");
      return;
    }

    // Mark as initialized
    hasInitialized.current = true;

    console.log("\n--------------------------------");
    console.log("🔄 [CLIENT] BookingInitializer - Setting Context Values");
    console.log("--------------------------------");
    console.log(`📆 Date/Time: ${new Date().toISOString()}`);
    console.log(`🏠 Setting propertySlug: ${property.slug}`);

    // Set property slug
    setPropertySlug(property.slug);

    // Set check-in date
    if (initialCheckIn) {
      console.log(`🛫 Setting checkInDate: ${initialCheckIn.toISOString()}`);
      setCheckInDate(initialCheckIn);
    } else {
      console.warn("⚠️ [CLIENT] No initialCheckIn to set in context");
    }

    // Set check-out date
    if (initialCheckOut) {
      console.log(`🛬 Setting checkOutDate: ${initialCheckOut.toISOString()}`);
      setCheckOutDate(initialCheckOut);
    } else {
      console.warn("⚠️ [CLIENT] No initialCheckOut to set in context");
    }

    // Set number of guests
    if (initialGuests) {
      console.log(`👥 Setting numberOfGuests: ${initialGuests}`);
      setNumberOfGuests(initialGuests);
    } else {
      console.log("ℹ️ [CLIENT] Using default number of guests (no URL parameter)");
    }

    // Calculate nights if both dates are provided
    if (initialCheckIn && initialCheckOut) {
      const nights = differenceInDays(initialCheckOut, initialCheckIn);
      if (nights > 0) {
        console.log(`🌙 Setting numberOfNights: ${nights}`);
        setNumberOfNights(nights);
      } else {
        console.warn(`⚠️ [CLIENT] Invalid nights calculation: ${nights} - not setting in context`);
      }
    } else {
      console.warn("⚠️ [CLIENT] Cannot calculate nights - missing date(s)");
    }

    console.log("✅ [CLIENT] BookingContext initialization complete");
    console.log("--------------------------------\n");
  }, []); // Empty dependency array = only run once

  return (
    <AvailabilityContainer
      property={property}
      initialCheckIn={initialCheckIn?.toISOString()}
      initialCheckOut={initialCheckOut?.toISOString()}
    />
  );
}

/**
 * Main booking container component
 * Handles URL parameters and provides the booking context
 */
export function BookingContainer({ property }: BookingContainerProps) {
  const searchParams = useSearchParams();

  // Parse date parameters from URL
  const checkInParam = searchParams?.get('checkIn');
  const checkOutParam = searchParams?.get('checkOut');
  const guestsParam = searchParams?.get('guests');

  console.log("\n================================");
  console.log("🔄 [CLIENT] BookingContainer Initialized");
  console.log("================================");
  console.log(`📆 Date/Time: ${new Date().toISOString()}`);
  console.log(`🏠 Property: ${property.name} (${property.slug})`);
  console.log(`🗓️ URL Params - Check-in: ${checkInParam || 'Not provided'}`);
  console.log(`🗓️ URL Params - Check-out: ${checkOutParam || 'Not provided'}`);
  console.log(`👥 URL Params - Guests: ${guestsParam || 'Not provided'}`);

  // Validate and parse check-in date
  let initialCheckIn: Date | undefined;
  if (checkInParam) {
    const parsedDate = parseISO(checkInParam);
    if (isValid(parsedDate)) {
      initialCheckIn = parsedDate;
      console.log(`✅ [CLIENT] Parsed check-in date: ${initialCheckIn.toISOString()}`);
    } else {
      console.error(`❌ [CLIENT] Invalid check-in date format: "${checkInParam}"`);
    }
  } else {
    console.warn("⚠️ [CLIENT] No check-in date provided in URL");
  }

  // Validate and parse check-out date
  let initialCheckOut: Date | undefined;
  if (checkOutParam) {
    const parsedDate = parseISO(checkOutParam);
    if (isValid(parsedDate)) {
      initialCheckOut = parsedDate;
      console.log(`✅ [CLIENT] Parsed check-out date: ${initialCheckOut.toISOString()}`);
    } else {
      console.error(`❌ [CLIENT] Invalid check-out date format: "${checkOutParam}"`);
    }
  } else {
    console.warn("⚠️ [CLIENT] No check-out date provided in URL");
  }

  // Parse guests param
  const initialGuests = guestsParam ? parseInt(guestsParam, 10) : undefined;
  if (initialGuests !== undefined) {
    console.log(`✅ [CLIENT] Parsed guests: ${initialGuests}`);
  }

  // Calculate nights if both dates are valid
  if (initialCheckIn && initialCheckOut) {
    const nights = differenceInDays(initialCheckOut, initialCheckIn);
    console.log(`📊 [CLIENT] Calculated nights: ${nights}`);

    if (nights <= 0) {
      console.warn("⚠️ [CLIENT] Potential issue: Check-out date is before or same as check-in date");
    }
  }

  console.log(`🚀 [CLIENT] Setting up BookingProvider with propertySlug: ${property.slug}`);
  console.log("================================\n");

  return (
    <BookingProvider propertySlug={property.slug}>
      <div className="w-full">
        <BookingInitializer
          property={property}
          initialCheckIn={initialCheckIn}
          initialCheckOut={initialCheckOut}
          initialGuests={initialGuests}
        />
      </div>
    </BookingProvider>
  );
}