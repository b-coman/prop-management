/**
 * BookingProvider V2.1 - Simplified State Management with Automatic Pricing
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Primary state management for booking system V2
 * @created: 2025-05-31
 * @updated: 2025-06-02 (V2.1 - Automatic pricing enhancement)
 * @description: Provides clean, simplified state management for the booking flow.
 *               Replaces the complex BookingContext.tsx with circular dependencies.
 *               V2.1 adds automatic pricing when dates are available.
 * @dependencies: Property type, session storage hooks, API services
 * @replaces: src/contexts/BookingContext.tsx
 * @v2.1-changes: Added debounced automatic pricing trigger, clear pricing on date/guest changes
 */

"use client";

import React, { createContext, useContext, useCallback, useEffect, useReducer } from 'react';
import { useSessionStorage } from '@/hooks/use-session-storage';
import type { Property, PricingResponse, CurrencyCode } from '@/types';
import { loggers } from '@/lib/logger';

// ===== Types =====

interface BookingState {
  // Property & Basic Info
  property: Property;
  propertySlug: string;
  
  // Date Selection State
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guestCount: number;
  
  // API Data State
  unavailableDates: Date[];
  isLoadingUnavailable: boolean;
  unavailableError: string | null;
  
  pricing: PricingResponse | null;
  isLoadingPricing: boolean;
  pricingError: string | null;
  
  // UI State
  selectedAction: 'book' | 'hold' | 'contact' | null;
  showMinStayWarning: boolean;
  
  // Form State
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    message?: string;
  };
  
  // Coupon State (for BookingForm)
  appliedCoupon: any | null;
}

interface BookingActions {
  // Date Management
  setCheckInDate: (date: Date | null) => void;
  setCheckOutDate: (date: Date | null) => void;
  setGuestCount: (count: number) => void;
  
  // API Calls
  fetchUnavailableDates: () => Promise<void>;
  fetchPricing: () => Promise<void>;
  
  // UI Actions
  setSelectedAction: (action: 'book' | 'hold' | 'contact' | null) => void;
  clearPricingError: () => void;
  dismissMinStayWarning: () => void;
  
  // Form Management
  updateGuestInfo: (info: Partial<BookingState['guestInfo']>) => void;
  
  // Individual form field setters (for V1 compatibility)
  setFirstName: (name: string) => void;
  setLastName: (name: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setMessage: (message: string) => void;
  
  // Coupon Management
  setAppliedCoupon: (coupon: any | null) => void;
  
  resetBookingState: () => void;
}

type BookingContextType = BookingState & BookingActions;

// ===== Context =====

const BookingContext = createContext<BookingContextType | null>(null);

// ===== Reducer =====

type BookingAction = 
  | { type: 'SET_CHECK_IN_DATE'; payload: Date | null }
  | { type: 'SET_CHECK_OUT_DATE'; payload: Date | null }
  | { type: 'SET_GUEST_COUNT'; payload: number }
  | { type: 'SET_UNAVAILABLE_DATES'; payload: { dates: Date[]; loading: boolean; error: string | null } }
  | { type: 'SET_PRICING'; payload: { pricing: PricingResponse | null; loading: boolean; error: string | null } }
  | { type: 'SET_SELECTED_ACTION'; payload: 'book' | 'hold' | 'contact' | null }
  | { type: 'SET_MIN_STAY_WARNING'; payload: boolean }
  | { type: 'UPDATE_GUEST_INFO'; payload: Partial<BookingState['guestInfo']> }
  | { type: 'SET_APPLIED_COUPON'; payload: any | null }
  | { type: 'CLEAR_PRICING_ERROR' }
  | { type: 'RESET_STATE' };

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_CHECK_IN_DATE':
      return { ...state, checkInDate: action.payload };
    
    case 'SET_CHECK_OUT_DATE':
      return { ...state, checkOutDate: action.payload };
    
    case 'SET_GUEST_COUNT':
      return { ...state, guestCount: action.payload };
    
    case 'SET_UNAVAILABLE_DATES':
      return {
        ...state,
        unavailableDates: action.payload.dates,
        isLoadingUnavailable: action.payload.loading,
        unavailableError: action.payload.error
      };
    
    case 'SET_PRICING':
      return {
        ...state,
        pricing: action.payload.pricing,
        isLoadingPricing: action.payload.loading,
        pricingError: action.payload.error
      };
    
    case 'SET_SELECTED_ACTION':
      return { ...state, selectedAction: action.payload };
    
    case 'SET_MIN_STAY_WARNING':
      return { ...state, showMinStayWarning: action.payload };
    
    case 'UPDATE_GUEST_INFO':
      return {
        ...state,
        guestInfo: { ...state.guestInfo, ...action.payload }
      };
    
    case 'SET_APPLIED_COUPON':
      return { ...state, appliedCoupon: action.payload };
    
    case 'CLEAR_PRICING_ERROR':
      return { ...state, pricingError: null };
    
    case 'RESET_STATE':
      return {
        ...state,
        checkInDate: null,
        checkOutDate: null,
        guestCount: state.property.baseOccupancy || 2,
        selectedAction: null,
        pricing: null,
        pricingError: null,
        guestInfo: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          message: ''
        },
        appliedCoupon: null
      };
    
    default:
      return state;
  }
}

// ===== Provider Component =====

interface BookingProviderProps {
  children: React.ReactNode;
  property: Property;
  initialCurrency?: CurrencyCode;
  initialLanguage?: string;
}

export function BookingProvider({ 
  children, 
  property,
  initialCurrency,
  initialLanguage
}: BookingProviderProps) {
  const propertySlug = property.slug;
  
  // Validate required property fields
  useEffect(() => {
    if (!property.baseOccupancy) {
      loggers.bookingContext.error('Missing required field: baseOccupancy', {
        propertyId: property.id,
        propertySlug: property.slug
      });
    }
    
    if (!property.maxGuests) {
      loggers.bookingContext.error('Missing required field: maxGuests', {
        propertyId: property.id,
        propertySlug: property.slug
      });
    }
    
    if (!property.defaultMinimumStay) {
      loggers.bookingContext.error('Missing required field: defaultMinimumStay', {
        propertyId: property.id,
        propertySlug: property.slug
      });
    }
  }, [property]);

  // Initial state
  const initialState: BookingState = {
    property,
    propertySlug,
    checkInDate: null,
    checkOutDate: null,
    guestCount: property.baseOccupancy || 2,
    unavailableDates: [],
    isLoadingUnavailable: false,
    unavailableError: null,
    pricing: null,
    isLoadingPricing: false,
    pricingError: null,
    selectedAction: null,
    showMinStayWarning: false,
    guestInfo: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: ''
    },
    appliedCoupon: null
  };

  const [state, dispatch] = useReducer(bookingReducer, initialState);

  // Session storage for critical data
  const [storedCheckIn, setStoredCheckIn] = useSessionStorage<Date | null>(
    `booking_${propertySlug}_checkIn`, 
    null
  );
  const [storedCheckOut, setStoredCheckOut] = useSessionStorage<Date | null>(
    `booking_${propertySlug}_checkOut`, 
    null
  );
  const [storedGuestCount, setStoredGuestCount] = useSessionStorage<number>(
    `booking_${propertySlug}_guests`, 
    property.baseOccupancy || 2
  );
  const [storedAction, setStoredAction] = useSessionStorage<string | null>(
    `booking_${propertySlug}_action`, 
    null
  );
  const [storedGuestInfo, setStoredGuestInfo] = useSessionStorage(
    `booking_${propertySlug}_guestInfo`,
    initialState.guestInfo
  );

  // Parse URL parameters on mount only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Parse dates from URL
    const checkInParam = urlParams.get('checkIn');
    const checkOutParam = urlParams.get('checkOut');
    const guestsParam = urlParams.get('guests');
    
    if (checkInParam) {
      try {
        const checkInDate = new Date(checkInParam);
        if (!isNaN(checkInDate.getTime())) {
          dispatch({ type: 'SET_CHECK_IN_DATE', payload: checkInDate });
          setStoredCheckIn(checkInDate);
        }
      } catch (error) {
        loggers.bookingContext.warn('Invalid checkIn date in URL', { checkInParam });
      }
    } else if (storedCheckIn) {
      dispatch({ type: 'SET_CHECK_IN_DATE', payload: storedCheckIn });
    }
    
    if (checkOutParam) {
      try {
        const checkOutDate = new Date(checkOutParam);
        if (!isNaN(checkOutDate.getTime())) {
          dispatch({ type: 'SET_CHECK_OUT_DATE', payload: checkOutDate });
          setStoredCheckOut(checkOutDate);
        }
      } catch (error) {
        loggers.bookingContext.warn('Invalid checkOut date in URL', { checkOutParam });
      }
    } else if (storedCheckOut) {
      dispatch({ type: 'SET_CHECK_OUT_DATE', payload: storedCheckOut });
    }
    
    if (guestsParam) {
      const guestCount = parseInt(guestsParam);
      if (!isNaN(guestCount) && guestCount >= 1 && guestCount <= property.maxGuests) {
        dispatch({ type: 'SET_GUEST_COUNT', payload: guestCount });
        setStoredGuestCount(guestCount);
      }
    } else if (storedGuestCount) {
      dispatch({ type: 'SET_GUEST_COUNT', payload: storedGuestCount });
    }
    
    // Restore other stored state
    if (storedAction && ['book', 'hold', 'contact'].includes(storedAction)) {
      dispatch({ type: 'SET_SELECTED_ACTION', payload: storedAction as any });
    }
    
    if (storedGuestInfo) {
      dispatch({ type: 'UPDATE_GUEST_INFO', payload: storedGuestInfo });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Action handlers
  const setCheckInDate = useCallback((date: Date | null) => {
    dispatch({ type: 'SET_CHECK_IN_DATE', payload: date });
    setStoredCheckIn(date);
    
    // V2.1: Clear pricing only if we have existing pricing data
    if (state.pricing) {
      dispatch({ type: 'SET_PRICING', payload: { pricing: null, loading: false, error: null } });
    }
    
    // Clear checkout if it violates minimum stay
    if (date && state.checkOutDate) {
      const daysBetween = Math.ceil((state.checkOutDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysBetween < (property.defaultMinimumStay || 1)) {
        dispatch({ type: 'SET_CHECK_OUT_DATE', payload: null });
        setStoredCheckOut(null);
        dispatch({ type: 'SET_MIN_STAY_WARNING', payload: true });
      }
    }
  }, [state.checkOutDate, state.pricing, property.defaultMinimumStay, setStoredCheckIn, setStoredCheckOut]);

  const setCheckOutDate = useCallback((date: Date | null) => {
    dispatch({ type: 'SET_CHECK_OUT_DATE', payload: date });
    setStoredCheckOut(date);
    
    // V2.1: Clear pricing only if we have existing pricing data
    if (state.pricing) {
      dispatch({ type: 'SET_PRICING', payload: { pricing: null, loading: false, error: null } });
    }
  }, [state.pricing, setStoredCheckOut]);

  const setGuestCount = useCallback((count: number) => {
    dispatch({ type: 'SET_GUEST_COUNT', payload: count });
    setStoredGuestCount(count);
    
    // V2.1: Clear pricing only if we have existing pricing data (most important for guest changes)
    if (state.pricing) {
      dispatch({ type: 'SET_PRICING', payload: { pricing: null, loading: false, error: null } });
    }
  }, [state.pricing, setStoredGuestCount]);

  const fetchUnavailableDates = useCallback(async () => {
    dispatch({ type: 'SET_UNAVAILABLE_DATES', payload: { dates: [], loading: true, error: null } });
    
    try {
      const response = await fetch(`/api/check-availability?propertySlug=${propertySlug}&months=12`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const dates = data.unavailableDates.map((dateStr: string) => new Date(dateStr));
      
      dispatch({ type: 'SET_UNAVAILABLE_DATES', payload: { dates, loading: false, error: null } });
      
      loggers.bookingContext.debug('Unavailable dates fetched successfully', {
        propertySlug,
        dateCount: dates.length
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SET_UNAVAILABLE_DATES', payload: { dates: [], loading: false, error: errorMessage } });
      
      loggers.bookingContext.error('Failed to fetch unavailable dates', error, {
        propertySlug
      });
    }
  }, [propertySlug]);

  const fetchPricing = useCallback(async () => {
    // Use console.log temporarily to ensure we see the logs
    console.log('[V2] fetchPricing called', {
      checkIn: state.checkInDate,
      checkOut: state.checkOutDate,
      guestCount: state.guestCount
    });
    loggers.bookingContext.debug('[V2] fetchPricing called', {
      checkIn: state.checkInDate,
      checkOut: state.checkOutDate,
      guestCount: state.guestCount
    });
    
    if (!state.checkInDate || !state.checkOutDate) {
      loggers.bookingContext.warn('Cannot fetch pricing without dates', {
        checkIn: state.checkInDate,
        checkOut: state.checkOutDate
      });
      return;
    }
    
    dispatch({ type: 'SET_PRICING', payload: { pricing: null, loading: true, error: null } });
    
    try {
      const response = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertySlug,
          checkIn: state.checkInDate.toISOString().split('T')[0],
          checkOut: state.checkOutDate.toISOString().split('T')[0],
          guests: state.guestCount
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      if (!data.available) {
        dispatch({ type: 'SET_PRICING', payload: { 
          pricing: null, 
          loading: false, 
          error: data.reason === 'minimum_stay' 
            ? `Minimum ${data.minimumStay} nights required from this date`
            : 'Selected dates are not available'
        } });
        return;
      }
      
      dispatch({ type: 'SET_PRICING', payload: { pricing: data.pricing, loading: false, error: null } });
      
      console.log('[V2] Pricing fetched successfully', {
        propertySlug,
        total: data.pricing.totalPrice,
        nights: data.pricing.numberOfNights,
        response: data
      });
      loggers.bookingContext.debug('[V2] Pricing fetched successfully', {
        propertySlug,
        total: data.pricing.totalPrice,
        nights: data.pricing.numberOfNights,
        response: data
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SET_PRICING', payload: { pricing: null, loading: false, error: errorMessage } });
      
      loggers.bookingContext.error('Failed to fetch pricing', error, {
        propertySlug,
        dates: { checkIn: state.checkInDate, checkOut: state.checkOutDate },
        guestCount: state.guestCount
      });
    }
  }, [state.checkInDate, state.checkOutDate, state.guestCount, propertySlug]);

  const setSelectedAction = useCallback((action: 'book' | 'hold' | 'contact' | null) => {
    dispatch({ type: 'SET_SELECTED_ACTION', payload: action });
    setStoredAction(action);
  }, [setStoredAction]);

  const clearPricingError = useCallback(() => {
    dispatch({ type: 'CLEAR_PRICING_ERROR' });
  }, []);

  const dismissMinStayWarning = useCallback(() => {
    dispatch({ type: 'SET_MIN_STAY_WARNING', payload: false });
  }, []);

  const updateGuestInfo = useCallback((info: Partial<BookingState['guestInfo']>) => {
    dispatch({ type: 'UPDATE_GUEST_INFO', payload: info });
    setStoredGuestInfo({ ...state.guestInfo, ...info });
  }, [state.guestInfo, setStoredGuestInfo]);

  // Individual setters for V1 compatibility
  const setFirstName = useCallback((name: string) => {
    updateGuestInfo({ firstName: name });
  }, [updateGuestInfo]);

  const setLastName = useCallback((name: string) => {
    updateGuestInfo({ lastName: name });
  }, [updateGuestInfo]);

  const setEmail = useCallback((email: string) => {
    updateGuestInfo({ email });
  }, [updateGuestInfo]);

  const setPhone = useCallback((phone: string) => {
    updateGuestInfo({ phone });
  }, [updateGuestInfo]);

  const setMessage = useCallback((message: string) => {
    updateGuestInfo({ message });
  }, [updateGuestInfo]);

  // Coupon management
  const setAppliedCoupon = useCallback((coupon: any | null) => {
    dispatch({ type: 'SET_APPLIED_COUPON', payload: coupon });
  }, []);

  const resetBookingState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    // Clear session storage
    setStoredCheckIn(null);
    setStoredCheckOut(null);
    setStoredGuestCount(property.baseOccupancy || 2);
    setStoredAction(null);
    setStoredGuestInfo(initialState.guestInfo);
  }, [property.baseOccupancy, setStoredCheckIn, setStoredCheckOut, setStoredGuestCount, setStoredAction, setStoredGuestInfo]);

  // Fetch unavailable dates on mount
  useEffect(() => {
    fetchUnavailableDates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // V2.1 Enhancement: Automatic pricing when dates are available
  useEffect(() => {
    // Only trigger automatic pricing if we have valid dates and guest count
    if (!state.checkInDate || !state.checkOutDate || !state.guestCount) {
      return;
    }

    // Only trigger if we don't already have pricing data
    if (state.pricing) {
      return;
    }

    // Debounce automatic pricing to prevent excessive API calls
    const timeoutId = setTimeout(async () => {
      try {
        loggers.bookingContext.debug('[V2.1] Auto-triggering pricing fetch', {
          checkIn: state.checkInDate,
          checkOut: state.checkOutDate,
          guestCount: state.guestCount
        });

        // Sequential pattern: Check if dates are still available, then fetch pricing
        await fetchPricing();
      } catch (error) {
        loggers.bookingContext.error('[V2.1] Auto-pricing failed', error, {
          checkIn: state.checkInDate,
          checkOut: state.checkOutDate,
          guestCount: state.guestCount
        });
      }
    }, 500); // 500ms debounce delay

    // Cleanup timeout on dependency change or unmount
    return () => clearTimeout(timeoutId);
  }, [state.checkInDate, state.checkOutDate, state.guestCount, state.pricing, fetchPricing]);

  const contextValue: BookingContextType = {
    ...state,
    // V1 compatibility - expose individual fields
    firstName: state.guestInfo.firstName,
    lastName: state.guestInfo.lastName,
    email: state.guestInfo.email,
    phone: state.guestInfo.phone,
    message: state.guestInfo.message || '',
    pricingDetails: state.pricing, // Forms expect this name
    // Actions
    setCheckInDate,
    setCheckOutDate,
    setGuestCount,
    fetchUnavailableDates,
    fetchPricing,
    setSelectedAction,
    clearPricingError,
    dismissMinStayWarning,
    updateGuestInfo,
    // Individual setters for V1 compatibility
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setMessage,
    setAppliedCoupon,
    resetBookingState
  };

  return (
    <BookingContext.Provider value={contextValue}>
      {children}
    </BookingContext.Provider>
  );
}

// ===== Hook =====

export function useBooking(): BookingContextType {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}