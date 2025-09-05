// src/lib/price-utils.ts
import type { CurrencyCode } from '@/types';

export interface PriceCalculationResult {
  basePrice: number; 
  baseRate?: number; // Alternative base rate field
  extraGuestFeeTotal: number; 
  extraGuestFee?: number; // Alternative extra guest fee field
  cleaningFee: number;
  subtotal: number; 
  accommodationTotal?: number; // Accommodation subtotal
  discountAmount: number;
  total: number;
  totalPrice?: number; // Alternative total price field
  taxes?: number;
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
  // Architecture Decision: Use API-only pricing (pre-calculated in Firestore)
  // Client-side calculations are incomplete compared to full API business logic
  console.log('[price-utils] ⚠️ Client-side price calculation bypassed (API-only architecture)');
  return null;
}