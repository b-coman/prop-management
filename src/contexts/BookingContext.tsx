"use client";

/**
 * BookingContext - Centralized booking state management
 * 
 * CLARITY IMPROVEMENTS:
 * 1. Renamed 'unavailableDates' to 'calendarUnavailableDates' to clarify it's for calendar display
 * 2. Added explicit 'bookingFlowStatus' to replace confusing boolean logic
 * 3. Clear separation between calendar data (all unavailable dates) and validation (isAvailable for selected range)
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSyncedSessionStorage, clearSyncedStorageByPrefix } from '@/hooks/use-synced-storage';
import type { CurrencyCode } from '@/types';
// V1 booking types removed, define locally
type BookingFlowStatus = 'initial' | 'dates_selected' | 'checking' | 'available' | 'unavailable' | 'error' | 'booking' | 'confirmed';

// Import required services for API pricing and availability
import { getPricingForDateRange, getUnavailableDatesForProperty } from '@/services/availabilityService';
// Removed - error messages now handled with translation system

// Define interface for centralized pricing state
export interface PricingDetails {
  accommodationTotal: number;
  cleaningFee: number;
  subtotal: number;
  total: number;
  totalPrice: number;  // Duplicate of total for naming consistency
  numberOfNights?: number; // Added for API-only architecture
  currency: CurrencyCode;
  dailyRates?: Record<string, number>;
  lengthOfStayDiscount?: {
    discountPercentage: number;
    discountAmount: number;
  } | null;
  couponDiscount?: {
    discountPercentage: number;
    discountAmount: number;
  } | null;
  datesFetched?: {
    checkIn: string;
    checkOut: string;
    guestCount: number;
  };
  timestamp: number;
}

interface BookingContextState {
  propertySlug: string | null;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  numberOfGuests: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  numberOfNights: number;
  totalPrice: number | null;
  appliedCouponCode: string | null;
  selectedCurrency: CurrencyCode;
  // Centralized pricing state
  pricingDetails: PricingDetails | null;
  isPricingLoading: boolean;
  pricingError: string | null;
  // Centralized availability state - RENAMED FOR CLARITY
  calendarUnavailableDates: Date[]; // For calendar display - all unavailable dates
  isAvailabilityLoading: boolean;
  availabilityError: string | null;
  isAvailable: boolean | null; // For selected date range validation
  // NEW: Explicit booking flow status
  bookingFlowStatus: BookingFlowStatus;
}

interface BookingContextActions {
  setPropertySlug: (slug: string | null) => void;
  setCheckInDate: (date: Date | null) => void;
  setCheckOutDate: (date: Date | null) => void;
  setNumberOfGuests: (guests: number) => void;
  // BUG #3 FIX: Source-based differentiation
  setCheckInDateFromURL: (date: Date | null) => void;
  setCheckOutDateFromURL: (date: Date | null) => void;
  setNumberOfGuestsFromURL: (guests: number) => void;
  setFirstName: (firstName: string) => void;
  setLastName: (lastName: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setMessage: (message: string) => void;
  setNumberOfNights: (nights: number) => void;
  setTotalPrice: (price: number | null) => void;
  setAppliedCouponCode: (code: string | null) => void;
  setSelectedCurrency: (currency: CurrencyCode) => void;
  clearBookingData: () => void;
  clearGuestData: () => void;
  // Separated API functions
  fetchAvailability: () => Promise<Date[]>;
  fetchPricing: (checkIn: Date, checkOut: Date, guests: number) => Promise<PricingDetails | null>;
  setPricingDetails: (pricing: PricingDetails | null) => void;
  resetPricing: () => void;
  // Legacy function kept for backward compatibility
  fetchAvailabilityAndPricing: () => Promise<{ pricing: PricingDetails | null; unavailableDates: Date[]; isAvailable: boolean }>;
  setCalendarUnavailableDates: (dates: Date[]) => void;
  setIsAvailable: (available: boolean | null) => void;
  setBookingFlowStatus: (status: BookingFlowStatus) => void;
}

interface BookingProviderProps {
  children: React.ReactNode;
  propertySlug?: string | null;
}

// Create contexts
const BookingStateContext = createContext<BookingContextState | undefined>(undefined);
const BookingActionsContext = createContext<BookingContextActions | undefined>(undefined);

// Storage keys
const STORAGE_PREFIX = 'booking_';
// Simplified storage key that doesn't depend on property slug
// This helps avoid issues when the property slug might change
const getStorageKey = (key: string, propertySlug?: string | null) => `${STORAGE_PREFIX}${key}`;

// Initial state
const getInitialState = (propertySlug?: string | null): BookingContextState => ({
  propertySlug: propertySlug || null,
  checkInDate: null,
  checkOutDate: null,
  numberOfGuests: 2,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
  numberOfNights: 0,
  totalPrice: null,
  appliedCouponCode: null,
  selectedCurrency: 'EUR',
  // Initialize pricing state
  pricingDetails: null,
  isPricingLoading: false,
  pricingError: null,
  // Initialize availability state
  calendarUnavailableDates: [],
  isAvailabilityLoading: false,
  availabilityError: null,
  isAvailable: null,
  bookingFlowStatus: 'initial',
});

// Version of the context - increment when making breaking changes
const CONTEXT_VERSION = 2; // Incremented for pricing state addition

// Singleton pattern for session IDs to prevent multiple initializations
// This ensures we reuse the same session ID for the same property during a single page visit
const getOrCreateSessionId = (propertySlug: string | null) => {
  // In client-side code, use sessionStorage to store the session ID
  if (typeof window !== 'undefined') {
    const storageKey = `booking_session_id_${propertySlug || 'global'}`;
    const existingId = sessionStorage.getItem(storageKey);

    if (existingId) {
      console.log(`[BookingContext] Reusing existing session: ${existingId} for property: ${propertySlug}`);
      return existingId;
    }

    // Create new session ID only if needed
    const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(storageKey, newId);
    console.log(`[BookingContext] Created new session: ${newId} for property: ${propertySlug}`);
    return newId;
  }

  // For server-side rendering, just create a temporary ID
  return `server-${Date.now()}`;
};

export const BookingProvider: React.FC<BookingProviderProps> = ({
  children,
  propertySlug = null
}) => {
  // Simplified - no longer tracking first mount

  // Get or create a consistent session ID for this property
  const sessionId = useMemo(() => getOrCreateSessionId(propertySlug), [propertySlug]);

  // Initialize with property-specific and session-specific prefix
  const storagePrefix = useMemo(
    () => {
      const prefix = propertySlug
        ? `${STORAGE_PREFIX}${propertySlug}_${sessionId}_`
        : `${STORAGE_PREFIX}${sessionId}_`;

      console.log(`[BookingContext] 🔑 Storage prefix calculation:`, {
        propertySlug,
        sessionId,
        resultingPrefix: prefix,
        timestamp: Date.now()
      });

      return prefix;
    },
    [propertySlug, sessionId]
  );

  // Add version tracking to detect incompatible changes
  const [contextVersion, setContextVersion] = useSyncedSessionStorage<number>(
    `${storagePrefix}version`,
    CONTEXT_VERSION,
    { prefix: '' }
  );

  // If version mismatches, clear all data
  useEffect(() => {
    if (contextVersion !== CONTEXT_VERSION) {
      console.log(`BookingContext version mismatch (stored: ${contextVersion}, current: ${CONTEXT_VERSION}), clearing data`);
      clearSyncedStorageByPrefix(storagePrefix, { prefix: '' });
      setContextVersion(CONTEXT_VERSION);
    }
  }, [contextVersion, setContextVersion, storagePrefix]);

  // Track previous date values to prevent unnecessary updates
  const prevCheckInDate = useRef<Date | null>(null);
  const prevCheckOutDate = useRef<Date | null>(null);
  
  // BUG #3 FIX: Track user interactions to prevent URL initialization from overriding user selections
  const hasUserInteractedWithDates = useRef(false);
  const hasUserInteractedWithGuests = useRef(false);
  
  // Prevent infinite fetch loops with timeout-based debouncing
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  
  // Set up synced storage hooks for each state piece
  const [storedPropertySlug, setStoredPropertySlug] = useSyncedSessionStorage<string | null>(
    `${storagePrefix}propertySlug`,
    propertySlug,
    { prefix: '' } // No additional prefix needed as we've included it in the key
  );
  
  const [checkInDate, setCheckInDateInternal] = useSyncedSessionStorage<Date | null>(
    `${storagePrefix}checkInDate`, 
    null,
    { prefix: '' }
  );
  
  const [checkOutDate, setCheckOutDateInternal] = useSyncedSessionStorage<Date | null>(
    `${storagePrefix}checkOutDate`, 
    null,
    { prefix: '' }
  );
  
  // BUG #3 FIX: User interaction date setter - marks user has interacted
  const setCheckInDate = useCallback((newDate: Date | null) => {
    // Skip update if the date is the same to prevent loops
    if (newDate === null && checkInDate === null) return;
    if (newDate && checkInDate && newDate.getTime() === checkInDate.getTime()) return;
    
    // Mark that user has interacted with dates
    hasUserInteractedWithDates.current = true;
    console.log(`[BookingContext] 👤 USER INTERACTION: setCheckInDate called with:`, newDate?.toISOString());
    
    // CRITICAL FIX: Extract intended date and create clean UTC date
    // Don't preserve timezone conversion artifacts from calendar midnight dates
    const normalizedDate = newDate ? (() => {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      const day = newDate.getDate();
      return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    })() : null;
    if (normalizedDate && newDate) {
      console.log(`[BookingContext] 📅 Fixed timezone normalization: ${newDate.toISOString()} → ${normalizedDate.toISOString()}`);
    }
    
    prevCheckInDate.current = normalizedDate;
    setCheckInDateInternal(normalizedDate);
    
    // Update booking flow status when dates change
    if (normalizedDate && checkOutDate) {
      setBookingFlowStatus('dates_selected');
    }
  }, [checkInDate, checkOutDate, setCheckInDateInternal]);

  // BUG #3 FIX: URL initialization date setter - does NOT override user interactions
  const setCheckInDateFromURL = useCallback((newDate: Date | null) => {
    // Skip if user has already interacted with dates
    if (hasUserInteractedWithDates.current) {
      console.log(`[BookingContext] 🚫 URL BLOCKED: User has interacted with dates, ignoring URL setCheckInDate`);
      return;
    }
    
    // Skip update if the date is the same to prevent loops
    if (newDate === null && checkInDate === null) return;
    if (newDate && checkInDate && newDate.getTime() === checkInDate.getTime()) return;
    
    console.log(`[BookingContext] 🔗 URL INIT: setCheckInDateFromURL called with:`, newDate?.toISOString());
    
    // CRITICAL FIX: Extract intended date and create clean UTC date
    // Don't preserve timezone conversion artifacts from calendar midnight dates
    const normalizedDate = newDate ? (() => {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      const day = newDate.getDate();
      return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    })() : null;
    if (normalizedDate && newDate) {
      console.log(`[BookingContext] 📅 Fixed timezone normalization: ${newDate.toISOString()} → ${normalizedDate.toISOString()}`);
    }
    
    prevCheckInDate.current = normalizedDate;
    setCheckInDateInternal(normalizedDate);
  }, [checkInDate, setCheckInDateInternal, hasUserInteractedWithDates]);
  
  // BUG #3 FIX: User interaction date setter - marks user has interacted
  const setCheckOutDate = useCallback((newDate: Date | null) => {
    // Skip update if the date is the same to prevent loops
    if (newDate === null && checkOutDate === null) return;
    if (newDate && checkOutDate && newDate.getTime() === checkOutDate.getTime()) return;
    
    // Mark that user has interacted with dates
    hasUserInteractedWithDates.current = true;
    console.log(`[BookingContext] 👤 USER INTERACTION: setCheckOutDate called with:`, newDate?.toISOString());
    
    // CRITICAL FIX: Extract intended date and create clean UTC date
    // Don't preserve timezone conversion artifacts from calendar midnight dates
    const normalizedDate = newDate ? (() => {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      const day = newDate.getDate();
      return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    })() : null;
    if (normalizedDate && newDate) {
      console.log(`[BookingContext] 📅 Fixed timezone normalization: ${newDate.toISOString()} → ${normalizedDate.toISOString()}`);
    }
    
    prevCheckOutDate.current = normalizedDate;
    setCheckOutDateInternal(normalizedDate);
    
    // Update booking flow status when dates change
    if (checkInDate && normalizedDate) {
      setBookingFlowStatus('dates_selected');
    }
  }, [checkInDate, checkOutDate, setCheckOutDateInternal]);

  // BUG #3 FIX: URL initialization date setter - does NOT override user interactions
  const setCheckOutDateFromURL = useCallback((newDate: Date | null) => {
    // Skip if user has already interacted with dates
    if (hasUserInteractedWithDates.current) {
      console.log(`[BookingContext] 🚫 URL BLOCKED: User has interacted with dates, ignoring URL setCheckOutDate`);
      return;
    }
    
    // Skip update if the date is the same to prevent loops
    if (newDate === null && checkOutDate === null) return;
    if (newDate && checkOutDate && newDate.getTime() === checkOutDate.getTime()) return;
    
    console.log(`[BookingContext] 🔗 URL INIT: setCheckOutDateFromURL called with:`, newDate?.toISOString());
    
    // CRITICAL FIX: Extract intended date and create clean UTC date
    // Don't preserve timezone conversion artifacts from calendar midnight dates  
    const normalizedDate = newDate ? (() => {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      const day = newDate.getDate();
      return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    })() : null;
    if (normalizedDate && newDate) {
      console.log(`[BookingContext] 📅 Fixed timezone normalization: ${newDate.toISOString()} → ${normalizedDate.toISOString()}`);
    }
    
    prevCheckOutDate.current = normalizedDate;
    setCheckOutDateInternal(normalizedDate);
  }, [checkOutDate, setCheckOutDateInternal, hasUserInteractedWithDates]);
  
  const [numberOfGuests, setNumberOfGuestsInternal] = useSyncedSessionStorage<number>(
    `${storagePrefix}numberOfGuests`, 
    2,
    { prefix: '' }
  );

  // BUG #3 FIX: User interaction guest setter - marks user has interacted
  const setNumberOfGuests = useCallback((newGuests: number) => {
    // Skip update if the value is the same to prevent loops
    if (newGuests === numberOfGuests) return;
    
    // Mark that user has interacted with guests
    hasUserInteractedWithGuests.current = true;
    console.log(`[BookingContext] 👤 USER INTERACTION: setNumberOfGuests called with:`, newGuests);
    
    setNumberOfGuestsInternal(newGuests);
  }, [numberOfGuests, setNumberOfGuestsInternal]);

  // BUG #3 FIX: URL initialization guest setter - does NOT override user interactions
  const setNumberOfGuestsFromURL = useCallback((newGuests: number) => {
    // Skip if user has already interacted with guests
    if (hasUserInteractedWithGuests.current) {
      console.log(`[BookingContext] 🚫 URL BLOCKED: User has interacted with guests, ignoring URL setNumberOfGuests`);
      return;
    }
    
    // Skip update if the value is the same to prevent loops
    if (newGuests === numberOfGuests) return;
    
    console.log(`[BookingContext] 🔗 URL INIT: setNumberOfGuestsFromURL called with:`, newGuests);
    setNumberOfGuestsInternal(newGuests);
  }, [numberOfGuests, setNumberOfGuestsInternal, hasUserInteractedWithGuests]);
  
  const [firstName, setFirstName] = useSyncedSessionStorage<string>(
    `${storagePrefix}firstName`, 
    '',
    { prefix: '' }
  );
  
  const [lastName, setLastName] = useSyncedSessionStorage<string>(
    `${storagePrefix}lastName`, 
    '',
    { prefix: '' }
  );
  
  const [email, setEmail] = useSyncedSessionStorage<string>(
    `${storagePrefix}email`, 
    '',
    { prefix: '' }
  );
  
  const [phone, setPhone] = useSyncedSessionStorage<string>(
    `${storagePrefix}phone`, 
    '',
    { prefix: '' }
  );
  
  const [message, setMessage] = useSyncedSessionStorage<string>(
    `${storagePrefix}message`, 
    '',
    { prefix: '' }
  );
  
  const [numberOfNights, setNumberOfNightsInternal] = useSyncedSessionStorage<number>(
    `${storagePrefix}numberOfNights`, 
    0,
    { prefix: '' }
  );
  
  // Wrap nights setter with value check to prevent unnecessary updates
  const setNumberOfNights = useCallback((newNights: number) => {
    // Skip update if the value is the same to prevent loops
    if (newNights === numberOfNights) return;
    
    // Now update the stored value
    setNumberOfNightsInternal(newNights);
  }, [numberOfNights, setNumberOfNightsInternal]);
  
  const [totalPrice, setTotalPrice] = useSyncedSessionStorage<number | null>(
    `${storagePrefix}totalPrice`, 
    null,
    { prefix: '' }
  );
  
  // Add centralized pricing state
  const [pricingDetails, setPricingDetailsInternal] = useSyncedSessionStorage<PricingDetails | null>(
    `${storagePrefix}pricingDetails`, 
    null,
    { prefix: '' }
  );
  
  const [isPricingLoading, setIsPricingLoading] = useState<boolean>(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Add centralized availability state - using useState for runtime state (re-fetched on each load)
  // RENAMED: calendarUnavailableDates to clarify this is for calendar display
  const [calendarUnavailableDates, setCalendarUnavailableDatesInternal] = useState<Date[]>([]);
  
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState<boolean>(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [isAvailable, setIsAvailableInternal] = useState<boolean | null>(null);
  
  // NEW: Booking flow status state
  const [bookingFlowStatus, setBookingFlowStatus] = useState<BookingFlowStatus>('initial');
  
  const [appliedCouponCode, setAppliedCouponCode] = useSyncedSessionStorage<string | null>(
    `${storagePrefix}appliedCouponCode`, 
    null,
    { prefix: '' }
  );
  
  const [selectedCurrency, setSelectedCurrency] = useSyncedSessionStorage<CurrencyCode>(
    `${storagePrefix}selectedCurrency`, 
    'EUR',
    { prefix: '' }
  );
  
  // Centralized pricing methods
  const setPricingDetails = useCallback((pricing: PricingDetails | null) => {
    console.log(`[BookingContext] 💰 setPricingDetails called with:`, pricing ? {
      total: pricing.total,
      numberOfNights: pricing.numberOfNights,
      timestamp: pricing.timestamp
    } : 'null');
    
    // DEBUG: Log call stack to trace where this is being called from
    if (pricing === null) {
      console.trace(`[BookingContext] ⚠️ setPricingDetails called with NULL - call stack:`);
    }
    
    console.log(`[BookingContext] 🔑 About to store pricing with storagePrefix: "${storagePrefix}"`);
    setPricingDetailsInternal(pricing);
    // If pricing contains a total price, also update the totalPrice field for backward compatibility
    if (pricing?.total) {
      setTotalPrice(pricing.total);
    }
    // BUG #1 FIX: Update numberOfNights from API response (API is the source of truth)
    console.log(`[BookingContext] 🔍 setPricingDetails called with numberOfNights:`, pricing?.numberOfNights);
    console.log(`[BookingContext] 🔍 Current context numberOfNights:`, numberOfNights);
    if (pricing?.numberOfNights) {
      console.log(`[BookingContext] 🔢 Updating numberOfNights from API: ${numberOfNights} → ${pricing.numberOfNights}`);
      setNumberOfNightsInternal(pricing.numberOfNights);
      console.log(`[BookingContext] 🔢 setNumberOfNightsInternal called with:`, pricing.numberOfNights);
    } else {
      console.log(`[BookingContext] ❌ No numberOfNights in pricing data:`, pricing);
    }
  }, [setPricingDetailsInternal, setTotalPrice, numberOfNights, setNumberOfNightsInternal]);
  
  const resetPricing = useCallback(() => {
    console.log(`[BookingContext] 🗑️ resetPricing called`);
    console.trace(`[BookingContext] 🗑️ resetPricing call stack:`);
    setPricingDetailsInternal(null);
    setPricingError(null);
    setIsPricingLoading(false);
  }, [setPricingDetailsInternal]);

  // Centralized availability methods
  const setCalendarUnavailableDates = useCallback((dates: Date[]) => {
    console.log(`[BookingContext] 🔍 setCalendarUnavailableDates called with ${dates.length} dates`);
    console.log(`[BookingContext] 🔍 First 3 dates:`, dates.slice(0, 3).map(d => ({
      type: typeof d,
      constructor: d?.constructor?.name,
      iso: d instanceof Date ? d.toISOString() : 'not a date',
      value: d
    })));
    setCalendarUnavailableDatesInternal(dates);
    // Note: State updates are asynchronous, so we can't check the value immediately
    console.log(`[BookingContext] 🔍 State update queued for ${dates.length} dates`);
  }, [setCalendarUnavailableDatesInternal]);

  const setIsAvailable = useCallback((available: boolean | null) => {
    setIsAvailableInternal(available);
    // Update booking flow status based on availability
    if (available === true) {
      setBookingFlowStatus('available');
    } else if (available === false) {
      setBookingFlowStatus('unavailable');
    }
  }, []);

  const resetAvailability = useCallback(() => {
    setCalendarUnavailableDatesInternal([]);
    setAvailabilityError(null);
    setIsAvailabilityLoading(false);
    setIsAvailableInternal(null);
  }, [setCalendarUnavailableDatesInternal]);
  
  // Fetch pricing data from API with date format debugging
  const fetchPricing = useCallback(async (): Promise<PricingDetails | null> => {
    // Generate a unique ID for this request for debugging purposes
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    // Check if we have all the required data
    if (!storedPropertySlug || !checkInDate || !checkOutDate) {
      console.log(`[BookingContext] ${requestId} Cannot fetch pricing - missing required data`);
      return null;
    }
    
    // Log the request details with detailed date format information
    console.log(`[BookingContext] ${requestId} 🔍 PRICING REQUEST TRIGGERED:`, {
      propertySlug: storedPropertySlug,
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(), 
      nights: numberOfNights,
      guests: numberOfGuests,
      timestamp: new Date().toISOString()
    });
    
    // Added debug info for better date tracking
    console.log(`[BookingContext] ${requestId} DATE DEBUG INFO:`);
    console.log(`[BookingContext] ${requestId} - Check-in: ${checkInDate.toISOString()} (year=${checkInDate.getFullYear()}, month=${checkInDate.getMonth()+1}, day=${checkInDate.getDate()}, hours=${checkInDate.getUTCHours()})`);
    console.log(`[BookingContext] ${requestId} - Check-out: ${checkOutDate.toISOString()} (year=${checkOutDate.getFullYear()}, month=${checkOutDate.getMonth()+1}, day=${checkOutDate.getDate()}, hours=${checkOutDate.getUTCHours()})`);
    
    try {
      setIsPricingLoading(true);
      setPricingError(null);
      setBookingFlowStatus('checking');
      
      // Call the pricing API
      const result = await getPricingForDateRange(
        storedPropertySlug,
        checkInDate,
        checkOutDate,
        numberOfGuests
      );
      
      // Check if we have valid pricing data OR if it's an availability error
      if (!result) {
        console.error(`[BookingContext] ${requestId} No result received from API`);
        setPricingError("Could not retrieve pricing information");
        return null;
      }
      
      // Check if the result indicates unavailability
      if (result.available === false) {
        console.log(`[BookingContext] ${requestId} Dates not available:`, result.reason);
        // Pass raw error structure for component to translate
        const errorMessage = result.reason === 'minimum_stay' && result.minimumStay
          ? `booking.minimumStayRequiredFromDate:${result.minimumStay}`
          : result.reason === 'unavailable_dates' && result.unavailableDates?.length > 1
          ? `booking.unavailableDatesEnhanced:${result.unavailableDates.length}`
          : result.reason === 'unavailable_dates'
          ? 'booking.oneUnavailableDate'
          : 'booking.datesUnavailable';
        
        setPricingError(errorMessage);
        return null;
      }
      
      // Check if we have valid pricing data
      if (!result.pricing) {
        console.error(`[BookingContext] ${requestId} No valid pricing data received from API`);
        setPricingError("Could not retrieve pricing information");
        return null;
      }
      
      console.log(`[BookingContext] ${requestId} Received pricing data:`, result.pricing);
      
      // Create standardized pricing details object
      const pricingData: PricingDetails = {
        accommodationTotal: result.pricing.subtotal - (result.pricing.cleaningFee || 0),
        cleaningFee: result.pricing.cleaningFee || 0,
        subtotal: result.pricing.subtotal,
        // Support both naming conventions for backward compatibility
        total: result.pricing.totalPrice || 0,
        totalPrice: result.pricing.totalPrice || 0,
        numberOfNights: (result.pricing as any).numberOfNights, // Include numberOfNights from API
        currency: result.pricing.currency as CurrencyCode,
        dailyRates: result.pricing.dailyRates || {},
        // Store date information for future reference
        datesFetched: {
          checkIn: checkInDate.toISOString(),
          checkOut: checkOutDate.toISOString(),
          guestCount: numberOfGuests
        },
        timestamp: Date.now()
      };
      
      // Store the pricing data in state
      setPricingDetails(pricingData);
      console.log(`[BookingContext] ${requestId} Successfully updated pricing state`);
      
      // DEBUG: Verify what's actually in storage after setting
      setTimeout(() => {
        const storageKey = `${storagePrefix}pricingDetails`;
        const storedValue = sessionStorage.getItem(storageKey);
        console.log(`[BookingContext] ${requestId} 🔍 VERIFICATION after 100ms: Storage key "${storageKey}" contains:`, storedValue ? 'DATA' : 'NULL');
        if (storedValue) {
          try {
            const parsed = JSON.parse(storedValue);
            console.log(`[BookingContext] ${requestId} 💰 Stored pricing verified:`, { total: parsed.total, nights: parsed.numberOfNights });
          } catch (e) {
            console.log(`[BookingContext] ${requestId} ⚠️ Could not parse stored pricing`);
          }
        }
      }, 100);
      
      return pricingData;
    } catch (error) {
      console.error(`[BookingContext] ${requestId} Error fetching pricing:`, error);
      
      // Enhanced error handling - check if it's a structured API error response
      if (error && typeof error === 'object' && 'available' in error && error.available === false) {
        // Pass structured error for translation
        const errorData = error as any;
        const errorMessage = errorData.reason === 'minimum_stay' && errorData.minimumStay
          ? `booking.minimumStayRequiredFromDate:${errorData.minimumStay}`
          : errorData.reason === 'unavailable_dates' && errorData.unavailableDates?.length > 1
          ? `booking.unavailableDatesEnhanced:${errorData.unavailableDates.length}`
          : errorData.reason === 'unavailable_dates'
          ? 'booking.oneUnavailableDate'
          : 'booking.datesUnavailable';
        setPricingError(errorMessage);
      } else {
        // Generic error fallback - use translation key
        setPricingError("booking.pricingError");
      }
      
      setBookingFlowStatus('error');
      return null;
    } finally {
      setIsPricingLoading(false);
    }
  }, [storedPropertySlug, checkInDate, checkOutDate, numberOfNights, numberOfGuests, setPricingDetails]);

  // NEW: Separate fetch function for availability only - Session-persistent
  const fetchAvailability = useCallback(async (): Promise<Date[]> => {
    // Generate a unique ID for this request for debugging purposes
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    console.log(`[BookingContext] ${requestId} 📅 AVAILABILITY ONLY: fetchAvailability started`);
    
    // Check if we have property slug
    if (!storedPropertySlug) {
      console.log(`[BookingContext] ${requestId} Cannot fetch availability - missing property slug`);
      return [];
    }
    
    try {
      setIsAvailabilityLoading(true);
      setAvailabilityError(null);
      
      console.log(`[BookingContext] ${requestId} 🏠 Fetching availability for property: ${storedPropertySlug}`);
      
      // Fetch unavailable dates (this loads the calendar data)
      const unavailableDatesResult = await getUnavailableDatesForProperty(storedPropertySlug);
      
      console.log(`[BookingContext] ${requestId} ✅ Loaded ${unavailableDatesResult.length} unavailable dates`);
      
      // Store unavailable dates in state
      setCalendarUnavailableDates(unavailableDatesResult);
      
      // Debug: Check what was actually set
      console.log(`[BookingContext] ${requestId} 🔍 DEBUG: unavailableDatesResult type:`, Array.isArray(unavailableDatesResult) ? 'array' : typeof unavailableDatesResult);
      console.log(`[BookingContext] ${requestId} 🔍 DEBUG: First date details:`, unavailableDatesResult[0] ? {
        type: typeof unavailableDatesResult[0],
        constructor: unavailableDatesResult[0]?.constructor?.name,
        iso: unavailableDatesResult[0] instanceof Date ? unavailableDatesResult[0].toISOString() : 'not a date',
        value: unavailableDatesResult[0]
      } : 'no dates');
      
      console.log(`[BookingContext] ${requestId} ✅ AVAILABILITY FETCH COMPLETE`);
      
      return unavailableDatesResult;
      
    } catch (error) {
      console.error(`[BookingContext] ${requestId} ❌ Error in fetchAvailability:`, error);
      setAvailabilityError("Error loading availability. Please try again.");
      setBookingFlowStatus('error');
      return [];
    } finally {
      setIsAvailabilityLoading(false);
    }
  }, [storedPropertySlug, setCalendarUnavailableDates]);

  // Alternative fetch function with explicit parameters (kept for potential future use)
  const fetchPricingWithDates = useCallback(async (checkIn: Date, checkOut: Date, guests: number): Promise<PricingDetails | null> => {
    // Generate a unique ID for this request for debugging purposes
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    console.log(`[BookingContext] ${requestId} 💰 PRICING ONLY: fetchPricing started`);
    
    // Check if we have all the required data
    if (!storedPropertySlug) {
      console.log(`[BookingContext] ${requestId} Cannot fetch pricing - missing property slug`);
      return null;
    }
    
    // Validate dates
    if (!checkIn || !checkOut) {
      console.log(`[BookingContext] ${requestId} Cannot fetch pricing - missing dates`);
      return null;
    }
    
    try {
      setIsPricingLoading(true);
      setPricingError(null);
      setBookingFlowStatus('checking');
      
      console.log(`[BookingContext] ${requestId} 🏠 Fetching pricing for property: ${storedPropertySlug}`);
      console.log(`[BookingContext] ${requestId} 📅 Dates: ${checkIn.toISOString()} to ${checkOut.toISOString()}`);
      console.log(`[BookingContext] ${requestId} 👥 Guests: ${guests}`);
      
      // Fetch pricing
      const pricingResponse = await getPricingForDateRange(
        storedPropertySlug,
        checkIn,
        checkOut,
        guests
      );
      
      if (!pricingResponse?.pricing) {
        console.error(`[BookingContext] ${requestId} No valid pricing data received from API`);
        setPricingError("Could not retrieve pricing information");
        return null;
      }
      
      console.log(`[BookingContext] ${requestId} Received pricing data:`, pricingResponse.pricing);
      console.log(`[BookingContext] ${requestId} 🔍 numberOfNights in API response:`, (pricingResponse.pricing as any).numberOfNights);
      
      // Create standardized pricing details object
      const pricingData: PricingDetails = {
        accommodationTotal: pricingResponse.pricing.subtotal - (pricingResponse.pricing.cleaningFee || 0),
        cleaningFee: pricingResponse.pricing.cleaningFee || 0,
        subtotal: pricingResponse.pricing.subtotal,
        total: pricingResponse.pricing.totalPrice || 0,
        totalPrice: pricingResponse.pricing.totalPrice || 0,
        numberOfNights: (pricingResponse.pricing as any).numberOfNights, // BUG #1 FIX: Include numberOfNights from API
        currency: pricingResponse.pricing.currency as CurrencyCode,
        dailyRates: pricingResponse.pricing.dailyRates || {},
        datesFetched: {
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guestCount: guests
        },
        timestamp: Date.now()
      };
      
      // Store the pricing data in state
      setPricingDetails(pricingData);
      console.log(`[BookingContext] ${requestId} ✅ PRICING FETCH COMPLETE: €${pricingData.total}`);
      
      return pricingData;
      
    } catch (error) {
      console.error(`[BookingContext] ${requestId} ❌ Error in fetchPricing:`, error);
      setPricingError("Error fetching pricing information. Please try again.");
      setBookingFlowStatus('error');
      return null;
    } finally {
      setIsPricingLoading(false);
    }
  }, [storedPropertySlug, setPricingDetails]);

  // LEGACY: Combined fetch function for BOTH availability and pricing - kept for backward compatibility
  const fetchAvailabilityAndPricing = useCallback(async (): Promise<{ 
    pricing: PricingDetails | null; 
    unavailableDates: Date[]; 
    isAvailable: boolean;
  }> => {
    // Generate a unique ID for this request for debugging purposes
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    console.log(`[BookingContext] ${requestId} 🚀 SINGLE API CALL: fetchAvailabilityAndPricing started`);
    
    // Check if we have all the required data
    if (!storedPropertySlug) {
      console.log(`[BookingContext] ${requestId} Cannot fetch data - missing property slug`);
      return { pricing: null, unavailableDates: [], isAvailable: true };
    }
    
    try {
      setIsPricingLoading(true);
      setIsAvailabilityLoading(true);
      setPricingError(null);
      setAvailabilityError(null);
      setBookingFlowStatus('checking');
      
      console.log(`[BookingContext] ${requestId} 🏠 Fetching data for property: ${storedPropertySlug}`);
      
      // STEP 1: Fetch unavailable dates (this loads the calendar data)
      console.log(`[BookingContext] ${requestId} 📅 Fetching unavailable dates...`);
      const unavailableDatesResult = await getUnavailableDatesForProperty(storedPropertySlug);
      
      console.log(`[BookingContext] ${requestId} ✅ Loaded ${unavailableDatesResult.length} unavailable dates`);
      
      // Store unavailable dates in state
      setCalendarUnavailableDates(unavailableDatesResult);
      
      // STEP 2: If we have check-in/check-out dates, also fetch pricing
      let pricingResult: PricingDetails | null = null;
      let availabilityResult = true; // Default to available
      
      if (checkInDate && checkOutDate && checkOutDate > checkInDate) {
        console.log(`[BookingContext] ${requestId} 💰 Fetching pricing for dates ${checkInDate.toISOString()} to ${checkOutDate.toISOString()}`);
        
        // Fetch pricing
        const pricingResponse = await getPricingForDateRange(
          storedPropertySlug,
          checkInDate,
          checkOutDate,
          numberOfGuests
        );
        
        if (pricingResponse?.pricing) {
          pricingResult = {
            accommodationTotal: pricingResponse.pricing.subtotal - (pricingResponse.pricing.cleaningFee || 0),
            cleaningFee: pricingResponse.pricing.cleaningFee || 0,
            subtotal: pricingResponse.pricing.subtotal,
            total: pricingResponse.pricing.totalPrice || 0,
            totalPrice: pricingResponse.pricing.totalPrice || 0,
            numberOfNights: (pricingResponse.pricing as any).numberOfNights, // BUG #1 FIX: Include numberOfNights from API
            currency: pricingResponse.pricing.currency as CurrencyCode,
            dailyRates: pricingResponse.pricing.dailyRates || {},
            datesFetched: {
              checkIn: checkInDate.toISOString(),
              checkOut: checkOutDate.toISOString(),
              guestCount: numberOfGuests
            },
            timestamp: Date.now()
          };
          
          console.log(`[BookingContext] ${requestId} ✅ Pricing fetched: €${pricingResult.total}`);
        }
        
        // Check availability for the selected dates
        console.log(`[BookingContext] ${requestId} 🔍 Checking availability for selected dates...`);
        
        let current = new Date(checkInDate.getTime());
        let conflict = false;
        
        while (current < checkOutDate) {
          const currentDateStr = current.toISOString().split('T')[0];
          const isUnavailable = unavailableDatesResult.some(d => 
            d.toISOString().split('T')[0] === currentDateStr
          );
          
          if (isUnavailable) {
            console.log(`[BookingContext] ${requestId} ❌ Conflict found on date: ${currentDateStr}`);
            conflict = true;
            break;
          }
          
          current.setDate(current.getDate() + 1);
        }
        
        availabilityResult = !conflict;
        console.log(`[BookingContext] ${requestId} ✅ Availability result: ${availabilityResult ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
      } else {
        console.log(`[BookingContext] ${requestId} ⏭️ Skipping pricing - no valid date range selected`);
      }
      
      // Update all states
      if (pricingResult) {
        setPricingDetails(pricingResult);
      }
      setIsAvailable(availabilityResult);
      
      console.log(`[BookingContext] ${requestId} ✅ SINGLE API CALL COMPLETE`);
      
      return { 
        pricing: pricingResult, 
        unavailableDates: unavailableDatesResult, 
        isAvailable: availabilityResult 
      };
      
    } catch (error) {
      console.error(`[BookingContext] ${requestId} ❌ Error in fetchAvailabilityAndPricing:`, error);
      setPricingError("Error fetching data. Please try again.");
      setAvailabilityError("Error loading availability. Please try again.");
      
      return { pricing: null, unavailableDates: [], isAvailable: true };
    } finally {
      setIsPricingLoading(false);
      setIsAvailabilityLoading(false);
    }
  }, [storedPropertySlug, checkInDate, checkOutDate, numberOfNights, numberOfGuests, 
      setPricingDetails, setCalendarUnavailableDates, setIsAvailable]);
  
  // Debug: Log calendarUnavailableDates before creating state
  if (calendarUnavailableDates.length > 0) {
    console.log(`[BookingContext] 📊 Creating state object with ${calendarUnavailableDates.length} unavailable dates`);
    console.log(`[BookingContext] 📊 First unavailable date:`, calendarUnavailableDates[0] instanceof Date ? calendarUnavailableDates[0].toISOString() : 'not a date');
  }

  // Create state object
  console.log('[BookingContext] Creating state object with calendarUnavailableDates:', calendarUnavailableDates.length, 'dates');
  const state: BookingContextState = {
    propertySlug: storedPropertySlug,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    firstName,
    lastName,
    email,
    phone,
    message,
    numberOfNights,
    totalPrice,
    appliedCouponCode,
    selectedCurrency,
    // Include centralized pricing state
    pricingDetails,
    isPricingLoading,
    pricingError,
    // Include centralized availability state
    calendarUnavailableDates,
    isAvailabilityLoading,
    availabilityError,
    isAvailable,
    bookingFlowStatus,
  };
  
  // Simplified availability loading - only fetch when explicitly needed

  // Simplified - no automatic fetching on mount or URL changes
  // Fetching is now explicitly controlled by components

  // LEGACY: Keep existing combined trigger for backward compatibility (disabled by default)
  const legacyAutoFetchEnabled = false; // Set to true to re-enable legacy behavior
  
  React.useEffect(() => {
    if (!legacyAutoFetchEnabled) return;
    
    // Simple debouncing - prevent excessive calls
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) { // Minimum 1 second between calls
      console.log(`[BookingContext] Debouncing legacy fetch call`);
      return;
    }
    
    // Prevent infinite loops
    if (isFetchingRef.current) {
      console.log(`[BookingContext] Skipping legacy fetch: Already fetching`);
      return;
    }
    
    // Only run if we have property slug and no loading is in progress
    if (storedPropertySlug && !isPricingLoading && !isAvailabilityLoading) {
      
      // Only fetch availability when property changes and we have no data yet
      const needsAvailabilityFetch = calendarUnavailableDates.length === 0;
      
      // Check if we need to fetch pricing (only when we have dates)
      const needsPricingFetch = checkInDate && checkOutDate && numberOfNights > 0 && (
        // If we have no pricing details yet
        !pricingDetails || 
        // Or if the dates have changed
        (pricingDetails.datesFetched && (
          pricingDetails.datesFetched.checkIn !== checkInDate.toISOString() ||
          pricingDetails.datesFetched.checkOut !== checkOutDate.toISOString() ||
          pricingDetails.datesFetched.guestCount !== numberOfGuests
        ))
      );
      
      if (needsAvailabilityFetch || needsPricingFetch) {
        console.log(`[BookingContext] Legacy auto-fetching: availability=${needsAvailabilityFetch}, pricing=${needsPricingFetch}`);
        
        lastFetchTimeRef.current = now;
        isFetchingRef.current = true;
        
        fetchAvailabilityAndPricing()
          .catch(error => {
            console.error(`[BookingContext] Legacy auto-fetch error:`, error);
          })
          .finally(() => {
            isFetchingRef.current = false;
          });
      } else {
        console.log(`[BookingContext] Skipping legacy fetch: Using existing data`);
      }
    }
  }, [storedPropertySlug, checkInDate, checkOutDate, numberOfNights, numberOfGuests]);

  // Action to clear all booking data
  const clearBookingData = useCallback(() => {
    if (propertySlug) {
      // Use the utility function to clear all storage with this prefix
      // This will clear all values in one go, even across components
      clearSyncedStorageByPrefix(`${STORAGE_PREFIX}${propertySlug}_`, { prefix: '' });

      // Still update local state for immediate UI feedback
      setCheckInDate(null);
      setCheckOutDate(null);
      setNumberOfGuests(2);
      setNumberOfNights(0);
      setTotalPrice(null);
      setAppliedCouponCode(null);
      resetPricing();
      resetAvailability();
    } else {
      // Fallback to individual clearing if no property slug
      setCheckInDate(null);
      setCheckOutDate(null);
      setNumberOfGuests(2);
      setNumberOfNights(0);
      setTotalPrice(null);
      setAppliedCouponCode(null);
      resetPricing();
      resetAvailability();
    }
  }, [propertySlug, setCheckInDate, setCheckOutDate, setNumberOfGuests, setNumberOfNights, 
      setTotalPrice, setAppliedCouponCode, resetPricing, resetAvailability]);

  // Action to clear just guest information
  const clearGuestData = useCallback(() => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setMessage('');
  }, [setFirstName, setLastName, setEmail, setPhone, setMessage]);
  
  // Create actions object
  const actions: BookingContextActions = {
    setPropertySlug: setStoredPropertySlug,
    setCheckInDate,
    setCheckOutDate,
    setNumberOfGuests,
    // BUG #3 FIX: URL-specific setters that don't override user interactions
    setCheckInDateFromURL,
    setCheckOutDateFromURL,
    setNumberOfGuestsFromURL,
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setMessage,
    setNumberOfNights,
    setTotalPrice,
    setAppliedCouponCode,
    setSelectedCurrency,
    clearBookingData,
    clearGuestData,
    // NEW: Separated API functions
    fetchAvailability,
    fetchPricing,
    setPricingDetails,
    resetPricing,
    // LEGACY: Combined function for backward compatibility
    fetchAvailabilityAndPricing,
    setCalendarUnavailableDates,
    setIsAvailable,
    setBookingFlowStatus,
  };
  
  // Log provider mounting for debugging
  useEffect(() => {
    console.log(`[BookingContext] Provider mounted for property "${propertySlug}" with session ID ${sessionId}`);
    console.log(`[BookingContext] Storage prefix: ${storagePrefix}`);
    
    // DEBUG: Log all booking-related keys in sessionStorage
    if (typeof window !== 'undefined') {
      const bookingKeys = Object.keys(sessionStorage).filter(key => key.includes('booking'));
      console.log(`[BookingContext] 🗂️ Existing booking keys in sessionStorage:`, bookingKeys);
      
      // Log pricing details key specifically
      const pricingKey = `${storagePrefix}pricingDetails`;
      const storedPricing = sessionStorage.getItem(pricingKey);
      console.log(`[BookingContext] 💰 Stored pricing at key "${pricingKey}":`, storedPricing ? 'EXISTS' : 'NOT FOUND');
    }
    
    return () => {
      console.log(`[BookingContext] Provider unmounted for property "${propertySlug}"`);
    };
  }, [propertySlug, sessionId, storagePrefix]);

  return (
    <BookingStateContext.Provider value={state}>
      <BookingActionsContext.Provider value={actions}>
        {children}
      </BookingActionsContext.Provider>
    </BookingStateContext.Provider>
  );
};



// Hooks for consuming the context - same behavior in dev and prod
export const useBookingState = () => {
  const context = useContext(BookingStateContext);

  if (context === undefined) {
    throw new Error('useBookingState must be used within a BookingProvider');
  }

  return context;
};

export const useBookingActions = () => {
  const context = useContext(BookingActionsContext);

  if (context === undefined) {
    throw new Error('useBookingActions must be used within a BookingProvider');
  }

  return context;
};

// Combined hook for convenience
export const useBooking = () => {
  const state = useBookingState();
  const actions = useBookingActions();
  return { ...state, ...actions };
};