export type DayStatus = 'available' | 'booked' | 'on-hold' | 'external-block' | 'manual-block';

export interface AvailabilityDayData {
  day: number;
  status: DayStatus;
  bookingId?: string;
  bookingDetails?: {
    guestName: string;
    checkIn: string;
    checkOut: string;
    source?: string;
    status: string;
    holdUntil?: string;
  };
  externalFeedName?: string;
  price?: number;

  // Bar rendering — set on booked/on-hold days
  bookingPosition?: 'start' | 'middle' | 'end' | 'single';

  // Checkout tail — set on the day after the last night
  checkoutBooking?: {
    bookingId: string;
    guestName: string;
    source?: string;
    barColor: 'emerald' | 'amber';
  };
}

export interface MonthAvailabilityData {
  propertyId: string;
  month: string; // YYYY-MM
  days: Record<number, AvailabilityDayData>;
  summary: {
    available: number;
    booked: number;
    onHold: number;
    externallyBlocked: number;
    manuallyBlocked: number;
  };
  currency?: string;
  priceRange?: {
    min: number;
    max: number;
  };
}
