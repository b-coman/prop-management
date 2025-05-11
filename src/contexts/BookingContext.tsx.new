"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
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

// Generate a unique session ID to isolate different booking sessions
// This ensures each time the user refreshes the page or navigates back after a redirect,
// they get a clean slate for storage
const generateSessionId = () => {
  // Use timestamp to ensure uniqueness
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const BookingProvider: React.FC<BookingProviderProps> = ({
  children,
  propertySlug = null
}) => {
  // Generate a session-specific ID to isolate different booking sessions
  const sessionId = useMemo(() => generateSessionId(), []);

  // Initialize with property-specific and session-specific prefix
  const storagePrefix = useMemo(
    () => {
      const prefix = propertySlug
        ? `${STORAGE_PREFIX}${propertySlug}_${sessionId}_`
        : `${STORAGE_PREFIX}${sessionId}_`;

      console.log(`Creating BookingProvider with storage prefix: ${prefix}`);
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
  
  return (
    <BookingStateContext.Provider value={state}>
      <BookingActionsContext.Provider value={actions}>
        {children}
      </BookingActionsContext.Provider>
    </BookingStateContext.Provider>
  );
};

// Hooks for consuming the context
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