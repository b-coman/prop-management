"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSyncedSessionStorage, clearSyncedStorageByPrefix } from '@/hooks/use-synced-storage';
import type { CurrencyCode } from '@/types';

// Import required service for API pricing
import { getPricingForDateRange } from '@/services/availabilityService';

// Define interface for centralized pricing state
export interface PricingDetails {
  accommodationTotal: number;
  cleaningFee: number;
  subtotal: number;
  total: number;
  totalPrice: number;  // Duplicate of total for naming consistency
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
}

interface BookingContextActions {
  setPropertySlug: (slug: string | null) => void;
  setCheckInDate: (date: Date | null) => void;
  setCheckOutDate: (date: Date | null) => void;
  setNumberOfGuests: (guests: number) => void;
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
  // Centralized pricing actions
  fetchPricing: () => Promise<PricingDetails | null>;
  setPricingDetails: (pricing: PricingDetails | null) => void;
  resetPricing: () => void;
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
  // Use a ref to track if this is the first mount
  const isFirstMount = useRef(true);

  // Get or create a consistent session ID for this property
  const sessionId = useMemo(() => getOrCreateSessionId(propertySlug), [propertySlug]);

  // Initialize with property-specific and session-specific prefix
  const storagePrefix = useMemo(
    () => {
      const prefix = propertySlug
        ? `${STORAGE_PREFIX}${propertySlug}_${sessionId}_`
        : `${STORAGE_PREFIX}${sessionId}_`;

      // Only log on first render to reduce console noise
      if (isFirstMount.current) {
        console.log(`[BookingContext] Using storage prefix: ${prefix}`);
        isFirstMount.current = false;
      }

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
  
  // Wrap date setters with date normalization and deep equality check
  const setCheckInDate = useCallback((newDate: Date | null) => {
    // Skip update if the date is the same to prevent loops
    if (newDate === null && checkInDate === null) return;
    if (newDate && checkInDate && newDate.getTime() === checkInDate.getTime()) return;
    
    // Normalize date to noon UTC to ensure consistent time across all date operations
    // This prevents timezone conversion issues when dates are passed to the pricing API
    const normalizedDate = newDate ? new Date(newDate) : null;
    if (normalizedDate) {
      // Always set time component to 12:00:00 UTC to ensure consistency
      normalizedDate.setUTCHours(12, 0, 0, 0);
      console.log(`[BookingContext] 📅 Normalized date: ${newDate.toISOString()} → ${normalizedDate.toISOString()}`); 
    }
    
    // Update our ref to track this value
    prevCheckInDate.current = normalizedDate;
    
    // Now update the stored value
    setCheckInDateInternal(normalizedDate);
  }, [checkInDate, setCheckInDateInternal]);
  
  const setCheckOutDate = useCallback((newDate: Date | null) => {
    // Skip update if the date is the same to prevent loops
    if (newDate === null && checkOutDate === null) return;
    if (newDate && checkOutDate && newDate.getTime() === checkOutDate.getTime()) return;
    
    // Normalize date to noon UTC to ensure consistent time across all date operations
    // This prevents timezone conversion issues when dates are passed to the pricing API
    const normalizedDate = newDate ? new Date(newDate) : null;
    if (normalizedDate) {
      // Always set time component to 12:00:00 UTC to ensure consistency
      normalizedDate.setUTCHours(12, 0, 0, 0);
      console.log(`[BookingContext] 📅 Normalized date: ${newDate.toISOString()} → ${normalizedDate.toISOString()}`);
    }
    
    // Update our ref to track this value
    prevCheckOutDate.current = normalizedDate;
    
    // Now update the stored value
    setCheckOutDateInternal(normalizedDate);
  }, [checkOutDate, setCheckOutDateInternal]);
  
  const [numberOfGuests, setNumberOfGuests] = useSyncedSessionStorage<number>(
    `${storagePrefix}numberOfGuests`, 
    2,
    { prefix: '' }
  );
  
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
    setPricingDetailsInternal(pricing);
    // If pricing contains a total price, also update the totalPrice field for backward compatibility
    if (pricing?.total) {
      setTotalPrice(pricing.total);
    }
  }, [setPricingDetailsInternal, setTotalPrice]);
  
  const resetPricing = useCallback(() => {
    setPricingDetailsInternal(null);
    setPricingError(null);
    setIsPricingLoading(false);
  }, [setPricingDetailsInternal]);
  
  // Fetch pricing data from API with date format debugging
  const fetchPricing = useCallback(async (): Promise<PricingDetails | null> => {
    // Generate a unique ID for this request for debugging purposes
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    // Check if we have all the required data
    if (!storedPropertySlug || !checkInDate || !checkOutDate || numberOfNights <= 0) {
      console.log(`[BookingContext] ${requestId} Cannot fetch pricing - missing required data`);
      return null;
    }
    
    // Log the request details with detailed date format information
    console.log(`[BookingContext] ${requestId} Fetching pricing for ${storedPropertySlug} with dates ${checkInDate.toISOString()} to ${checkOutDate.toISOString()} and ${numberOfGuests} guests`);
    
    // Added debug info for better date tracking
    console.log(`[BookingContext] ${requestId} DATE DEBUG INFO:`);
    console.log(`[BookingContext] ${requestId} - Check-in: ${checkInDate.toISOString()} (year=${checkInDate.getFullYear()}, month=${checkInDate.getMonth()+1}, day=${checkInDate.getDate()}, hours=${checkInDate.getUTCHours()})`);
    console.log(`[BookingContext] ${requestId} - Check-out: ${checkOutDate.toISOString()} (year=${checkOutDate.getFullYear()}, month=${checkOutDate.getMonth()+1}, day=${checkOutDate.getDate()}, hours=${checkOutDate.getUTCHours()})`);
    
    try {
      setIsPricingLoading(true);
      setPricingError(null);
      
      // Call the pricing API
      const result = await getPricingForDateRange(
        storedPropertySlug,
        checkInDate,
        checkOutDate,
        numberOfGuests
      );
      
      // Check if we have valid pricing data
      if (!result || !result.pricing) {
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
        total: result.pricing.totalPrice !== undefined ? result.pricing.totalPrice : result.pricing.total || 0,
        totalPrice: result.pricing.totalPrice !== undefined ? result.pricing.totalPrice : result.pricing.total || 0,
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
      
      return pricingData;
    } catch (error) {
      console.error(`[BookingContext] ${requestId} Error fetching pricing:`, error);
      setPricingError("Error fetching pricing information. Please try again.");
      return null;
    } finally {
      setIsPricingLoading(false);
    }
  }, [storedPropertySlug, checkInDate, checkOutDate, numberOfNights, numberOfGuests, setPricingDetails]);
  
  // Create state object
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
  };
  
  // Effect to auto-fetch pricing when dates or guests change
  React.useEffect(() => {
    // Only run if we have all required data and no pricing loading is in progress
    if (storedPropertySlug && checkInDate && checkOutDate && numberOfNights > 0 && !isPricingLoading) {
      // Check if we need to fetch pricing with more detailed logging
      const needsFetch = (
        // If we have no pricing details yet
        !pricingDetails || 
        // Or if the dates have changed
        (pricingDetails.datesFetched && (
          pricingDetails.datesFetched.checkIn !== checkInDate.toISOString() ||
          pricingDetails.datesFetched.checkOut !== checkOutDate.toISOString() ||
          pricingDetails.datesFetched.guestCount !== numberOfGuests
        ))
      );
      
      if (needsFetch) {
        // Log specific reason for fetch
        if (!pricingDetails) {
          console.log(`[BookingContext] Auto-fetching pricing: No existing pricing data`);
        } else if (pricingDetails.datesFetched) {
          console.log(`[BookingContext] Auto-fetching pricing: Data change detected`);
          console.log(`[BookingContext] Date comparison:`);
          console.log(`- Stored check-in: ${pricingDetails.datesFetched.checkIn}`);
          console.log(`- Current check-in: ${checkInDate.toISOString()}`);
          console.log(`- Stored check-out: ${pricingDetails.datesFetched.checkOut}`);
          console.log(`- Current check-out: ${checkOutDate.toISOString()}`);
          console.log(`- Stored guests: ${pricingDetails.datesFetched.guestCount}`);
          console.log(`- Current guests: ${numberOfGuests}`);
        }
        
        fetchPricing().catch(error => {
          console.error(`[BookingContext] Auto-fetch pricing error:`, error);
        });
      } else {
        console.log(`[BookingContext] Skipping price fetch: Using existing data with same parameters`);
      }
    }
  }, [storedPropertySlug, checkInDate, checkOutDate, numberOfNights, numberOfGuests, 
      pricingDetails, isPricingLoading, fetchPricing]);

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
    } else {
      // Fallback to individual clearing if no property slug
      setCheckInDate(null);
      setCheckOutDate(null);
      setNumberOfGuests(2);
      setNumberOfNights(0);
      setTotalPrice(null);
      setAppliedCouponCode(null);
      resetPricing();
    }
  }, [propertySlug, setCheckInDate, setCheckOutDate, setNumberOfGuests, setNumberOfNights, 
      setTotalPrice, setAppliedCouponCode, resetPricing]);

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
    // Add centralized pricing actions
    fetchPricing,
    setPricingDetails,
    resetPricing,
  };
  
  // Add a mountCount check to detect duplicate/nested providers in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Use a property-specific key for this check
      const mountKey = `booking_provider_mounted_${propertySlug || 'global'}`;
      const mountCountKey = `booking_provider_mount_count_${propertySlug || 'global'}`;

      if (typeof window !== 'undefined') {
        // Increment mount count for tracking
        const currentCount = window[mountCountKey as any] || 0;
        window[mountCountKey as any] = currentCount + 1;

        if (window[mountKey as any]) {
          console.warn(
            `[BookingContext] ⚠️ Multiple BookingProvider instances detected for property "${propertySlug}" (count: ${window[mountCountKey as any]}). ` +
            `This can cause state conflicts and performance issues. ` +
            `Provider IDs may include: ${window[mountKey as any] || 'unknown'}, ${sessionId}. ` +
            `Ensure you only mount one BookingProvider per property.`
          );

          // Add this provider ID to the list for debugging
          if (typeof window[mountKey as any] === 'string') {
            window[mountKey as any] = `${window[mountKey as any]}, ${sessionId}`;
          } else {
            window[mountKey as any] = sessionId;
          }
        } else {
          // Mark this provider as mounted
          window[mountKey as any] = sessionId;
          console.log(`[BookingContext] Provider mounted for property "${propertySlug}" with session ID ${sessionId}`);
        }

        // Clean up on unmount
        return () => {
          if (window[mountCountKey as any] > 0) {
            window[mountCountKey as any] = window[mountCountKey as any] - 1;
          }

          if (window[mountCountKey as any] === 0) {
            window[mountKey as any] = false;
            console.log(`[BookingContext] All providers unmounted for property "${propertySlug}"`);
          } else {
            console.log(`[BookingContext] Provider unmounted for property "${propertySlug}", ${window[mountCountKey as any]} remaining`);
          }
        };
      }
    }
  }, [propertySlug, sessionId]);

  return (
    <BookingStateContext.Provider value={state}>
      <BookingActionsContext.Provider value={actions}>
        {children}
      </BookingActionsContext.Provider>
    </BookingStateContext.Provider>
  );
};

// Global data shared between multiple provider instances
// This helps prevent state conflicts when multiple providers mount due to React Strict Mode
// We store references indexed by property slug to keep data separate between different properties
interface GlobalContextCache {
  states: Record<string, BookingContextState>;
  actions: Record<string, BookingContextActions>;
  initialized: boolean;
}

// Initialize the global cache object
const globalContextCache: GlobalContextCache = {
  states: {},
  actions: {},
  initialized: false
};

// Global fallback data to use when outside a provider
// This helps prevent errors in development with hot reloading and strict mode
let globalFallbackState: BookingContextState | null = null;
let globalFallbackActions: BookingContextActions | null = null;

// Hooks for consuming the context with improved error handling
export const useBookingState = () => {
  const context = useContext(BookingStateContext);

  // Instead of throwing, use fallback in development
  if (context === undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[BookingContext] useBookingState called outside a BookingProvider. ' +
        'This may happen during development with hot reloading, ' +
        'but should be fixed in production.'
      );

      // Initialize fallback if needed
      if (!globalFallbackState) {
        globalFallbackState = getInitialState(null);
      }

      return globalFallbackState;
    }

    // In production, still throw the error
    throw new Error('useBookingState must be used within a BookingProvider');
  }

  return context;
};

export const useBookingActions = () => {
  const context = useContext(BookingActionsContext);

  // Instead of throwing, use fallback in development
  if (context === undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[BookingContext] useBookingActions called outside a BookingProvider. ' +
        'This may happen during development with hot reloading, ' +
        'but should be fixed in production.'
      );

      // Initialize fallback if needed - no-op functions
      if (!globalFallbackActions) {
        globalFallbackActions = {
          setPropertySlug: () => {},
          setCheckInDate: () => {},
          setCheckOutDate: () => {},
          setNumberOfGuests: () => {},
          setFirstName: () => {},
          setLastName: () => {},
          setEmail: () => {},
          setPhone: () => {},
          setMessage: () => {},
          setNumberOfNights: () => {},
          setTotalPrice: () => {},
          setAppliedCouponCode: () => {},
          setSelectedCurrency: () => {},
          clearBookingData: () => {},
          clearGuestData: () => {},
          // Add stubs for new methods
          fetchPricing: async () => null,
          setPricingDetails: () => {},
          resetPricing: () => {},
        };
      }

      return globalFallbackActions;
    }

    // In production, still throw the error
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