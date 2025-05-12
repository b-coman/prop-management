"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSyncedSessionStorage, clearSyncedStorageByPrefix } from '@/hooks/use-synced-storage';
import type { CurrencyCode } from '@/types';

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
});

// Version of the context - increment when making breaking changes
const CONTEXT_VERSION = 1;

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

  // Set up synced storage hooks for each state piece
  const [storedPropertySlug, setStoredPropertySlug] = useSyncedSessionStorage<string | null>(
    `${storagePrefix}propertySlug`,
    propertySlug,
    { prefix: '' } // No additional prefix needed as we've included it in the key
  );
  
  const [checkInDate, setCheckInDate] = useSyncedSessionStorage<Date | null>(
    `${storagePrefix}checkInDate`, 
    null,
    { prefix: '' }
  );
  
  const [checkOutDate, setCheckOutDate] = useSyncedSessionStorage<Date | null>(
    `${storagePrefix}checkOutDate`, 
    null,
    { prefix: '' }
  );
  
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
  
  const [numberOfNights, setNumberOfNights] = useSyncedSessionStorage<number>(
    `${storagePrefix}numberOfNights`, 
    0,
    { prefix: '' }
  );
  
  const [totalPrice, setTotalPrice] = useSyncedSessionStorage<number | null>(
    `${storagePrefix}totalPrice`, 
    null,
    { prefix: '' }
  );
  
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
  };
  
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
    } else {
      // Fallback to individual clearing if no property slug
      setCheckInDate(null);
      setCheckOutDate(null);
      setNumberOfGuests(2);
      setNumberOfNights(0);
      setTotalPrice(null);
      setAppliedCouponCode(null);
    }
  }, [propertySlug, setCheckInDate, setCheckOutDate, setNumberOfGuests, setNumberOfNights, setTotalPrice, setAppliedCouponCode]);

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