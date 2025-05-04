
// src/lib/price-utils.ts

interface PriceDetails {
  basePrice: number; // (pricePerNight * numberOfNights)
  extraGuestFee: number; // Total extra guest fee for the stay
  cleaningFee: number;
  subtotal: number; // (basePrice + extraGuestFee + cleaningFee)
  discountAmount: number;
  total: number; // (subtotal - discountAmount)
}

/**
 * Calculates the booking price details.
 *
 * @param pricePerNight - The base price per night for the property.
 * @param numberOfNights - The total number of nights for the booking.
 * @param cleaningFee - The fixed cleaning fee for the booking.
 * @param numberOfGuests - The total number of guests.
 * @param baseOccupancy - The number of guests included in the base price.
 * @param extraGuestFeePerNight - The fee per extra guest, per night.
 * @param discountPercentage - Optional discount percentage to apply (0-100).
 * @returns An object containing the detailed price breakdown.
 */
export function calculatePrice(
  pricePerNight: number,
  numberOfNights: number,
  cleaningFee: number,
  numberOfGuests: number,
  baseOccupancy: number,
  extraGuestFeePerNight: number,
  discountPercentage: number = 0
): PriceDetails {
  if (numberOfNights <= 0) {
    // Return zero values if nights are invalid
    return { basePrice: 0, extraGuestFee: 0, cleaningFee: 0, subtotal: 0, discountAmount: 0, total: 0 };
  }

  const basePrice = pricePerNight * numberOfNights;

  const extraGuests = Math.max(0, numberOfGuests - baseOccupancy);
  const totalExtraGuestFee = extraGuests * extraGuestFeePerNight * numberOfNights;

  const subtotal = basePrice + totalExtraGuestFee + cleaningFee;

  const discountAmount = subtotal * (discountPercentage / 100);

  const total = subtotal - discountAmount;

  return {
    basePrice: basePrice,
    extraGuestFee: totalExtraGuestFee,
    cleaningFee: cleaningFee,
    subtotal: subtotal,
    discountAmount: discountAmount,
    total: total,
  };
}
