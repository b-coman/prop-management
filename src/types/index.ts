import type { Timestamp } from 'firebase/firestore';

export interface Property {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  images: Array<{
    url: string;
    alt: string;
    isFeatured: boolean;
  }>;
  amenities: string[];
  pricePerNight: number;
  cleaningFee: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  squareFeet: number;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string[];
  cancellationPolicy: string;
}

export interface Booking {
  id: string;
  propertyId: string;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  };
  checkInDate: Timestamp;
  checkOutDate: Timestamp;
  numberOfGuests: number;
  totalPrice: number;
  cleaningFee: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentInfo: {
    stripePaymentIntentId: string;
    amount: number;
    status: string;
    paidAt: Timestamp | null; // Allow null if payment is pending
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
