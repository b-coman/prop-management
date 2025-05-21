// src/lib/price-utils.ts
import type { CurrencyCode } from '@/types';
import { getFeatureFlag } from '@/config/featureFlags';

export interface PriceCalculationResult {
  basePrice: number; 
  extraGuestFeeTotal: number; 
  cleaningFee: number;
  subtotal: number; 
  discountAmount: number;
  total: number; 
  currency: CurrencyCode; // The currency in which these prices are calculated
  numberOfNights: number;
  numberOfExtraGuests: number;
}

/**
 * Calculates the booking price details in the property's base currency.
 *
 * @param pricePerNight - The base price per night for the property.
 * @param numberOfNights - The total number of nights for the booking.
 * @param cleaningFee - The fixed cleaning fee for the booking.
 * @param numberOfGuests - The total number of guests.
 * @param baseOccupancy - The number of guests included in the base price.
 * @param extraGuestFeePerNight - The fee per extra guest, per night.
 * @param baseCurrency - The base currency of the property.
 * @param discountPercentage - Optional discount percentage to apply (0-100).
 * @returns An object containing the detailed price breakdown in the base currency.
 */
export function calculatePrice(
  pricePerNight: number,
  numberOfNights: number,
  cleaningFee: number,
  numberOfGuests: number,
  baseOccupancy: number,
  extraGuestFeePerNight: number,
  baseCurrency: CurrencyCode, // Property's base currency
  discountPercentage: number = 0
): PriceCalculationResult | null {
  // Check if API-only pricing is enabled
  if (getFeatureFlag('useApiOnlyPricing')) {
    console.log('[price-utils] ⚠️ Client-side price calculation bypassed (API-only mode)');
    return null;
  }
  
  if (numberOfNights <= 0) {
    return { 
      basePrice: 0, 
      extraGuestFeeTotal: 0, 
      cleaningFee: 0, 
      subtotal: 0, 
      discountAmount: 0, 
      total: 0, 
      currency: baseCurrency,
      numberOfNights: 0,
      numberOfExtraGuests: 0,
    };
  }

  const basePrice = pricePerNight * numberOfNights;

  const numberOfExtraGuests = Math.max(0, numberOfGuests - baseOccupancy);
  const extraGuestFeeTotal = numberOfExtraGuests * extraGuestFeePerNight * numberOfNights;

  const subtotal = basePrice + extraGuestFeeTotal + cleaningFee;

  const discountAmount = subtotal * (discountPercentage / 100);

  const total = subtotal - discountAmount;

  return {
    basePrice: basePrice,
    extraGuestFeeTotal: extraGuestFeeTotal,
    cleaningFee: cleaningFee,
    subtotal: subtotal,
    discountAmount: discountAmount,
    total: total,
    currency: baseCurrency,
    numberOfNights: numberOfNights,
    numberOfExtraGuests: numberOfExtraGuests,
  };
}