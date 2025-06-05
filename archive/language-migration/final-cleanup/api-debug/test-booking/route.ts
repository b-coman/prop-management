// src/app/api/test-booking/route.ts
import { createBooking, type CreateBookingData } from "@/services/bookingService";
import { NextResponse } from "next/server";

export async function POST() {
  const mockBookingData: CreateBookingData = {
    propertyId: "some-property-id",
    guestInfo: {
      firstName: "Test",
      lastName: "Guest",
      email: "test@example.com",
      userId: "some-user-id",
    },
    checkInDate: new Date().toISOString(),
    checkOutDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    numberOfGuests: 2,
    pricing: {
      baseRate: 100,
      numberOfNights: 2,
      cleaningFee: 20,
      subtotal: 220,
      taxes: 0,
      total: 220,
    },
    paymentInput: {
      stripePaymentIntentId: "mock-payment-intent-id",
      amount: 220,
      status: "succeeded",
    },
  };

  try {
    const bookingId = await createBooking(mockBookingData);
    return NextResponse.json({ message: "Booking created successfully", bookingId }, { status: 200 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}