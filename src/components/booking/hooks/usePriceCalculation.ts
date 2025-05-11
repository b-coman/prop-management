"use client";

import { useMemo, useState } from 'react';
import type { Property, CurrencyCode } from '@/types';
import { useBooking } from '@/contexts/BookingContext'; 
import { useCurrency } from '@/contexts/CurrencyContext';
import { calculatePrice } from '@/lib/price-utils';
import { useDateCalculation } from './useDateCalculation';

/**
 * Custom hook for pricing calculations
 */
export function usePriceCalculation(property: Property) {
  const { 
    numberOfGuests, 
    numberOfNights,
    appliedCouponCode,
  } = useBooking();
  
  const { getNightCount } = useDateCalculation();
  const { baseCurrencyForProperty, selectedCurrency, convertToSelectedCurrency, formatPrice } = useCurrency();
  
  // Track applied coupon
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);
  
  // Get the property's base currency
  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency);
  
  // Calculate pricing details based on current state
  const pricingDetails = useMemo(() => {
    // Get actual nights (might be 0 if not calculated yet)
    const actualNights = numberOfNights > 0 ? numberOfNights : getNightCount();
    
    // Only calculate if we have valid data
    if (actualNights > 0 && numberOfGuests > 0) {
      return calculatePrice(
        property.pricePerNight,
        actualNights,
        property.cleaningFee ?? 0,
        numberOfGuests,
        property.baseOccupancy,
        property.extraGuestFee ?? 0,
        propertyBaseCcy,
        appliedCoupon?.discountPercentage
      );
    }
    
    return null;
  }, [
    getNightCount,
    numberOfGuests, 
    numberOfNights, 
    property.baseOccupancy,
    property.cleaningFee,
    property.extraGuestFee,
    property.pricePerNight, 
    propertyBaseCcy, 
    appliedCoupon?.discountPercentage
  ]);
  
  /**
   * Format a price amount in the selected currency
   */
  const formatPriceInSelectedCurrency = (amount: number) => {
    return formatPrice(convertToSelectedCurrency(amount, propertyBaseCcy), selectedCurrency);
  };
  
  /**
   * Apply a coupon code and its discount
   */
  const applyCoupon = (code: string, discountPercentage: number) => {
    setAppliedCoupon({ code, discountPercentage });
  };
  
  /**
   * Remove applied coupon
   */
  const removeCoupon = () => {
    setAppliedCoupon(null);
  };
  
  return {
    pricingDetails,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    formatPriceInSelectedCurrency,
    propertyBaseCcy,
    selectedCurrency,
  };
}