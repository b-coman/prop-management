// src/components/TestBookingButton.tsx
'use client';

import { createBooking, type CreateBookingData } from "@/services/bookingService";
import { useState } from "react";
import { Button } from "./ui/button"; // Use ShadCN button
import { useToast } from "@/hooks/use-toast"; // Use toaster for feedback
import { Loader2 } from "lucide-react";

// Realistic mock data based on CreateBookingData structure
const mockBookingData: CreateBookingData = {
  propertyId: "prop1", // Use an existing placeholder property ID
  guestInfo: {
    firstName: "Dev",
    lastName: "Tester",
    email: "dev.tester@example.com",
    userId: "dev-user-123", // Optional user ID
    phone: "+15551112233",
  },
  // Use ISO strings for dates
  checkInDate: new Date(Date.now() + 86400000 * 7).toISOString(), // One week from now
  checkOutDate: new Date(Date.now() + 86400000 * 9).toISOString(), // Two nights later
  numberOfGuests: 2,
  pricing: {
    baseRate: 180, // Match Prahova Chalet price
    numberOfNights: 2, // Calculated from dates
    cleaningFee: 40, // Match Prahova Chalet fee
    subtotal: (180 * 2) + 40, // 360 + 40 = 400
    taxes: 0, // Assuming no taxes for mock
    total: 400, // Subtotal + taxes
  },
  paymentInput: {
    // Use a clearly identifiable mock ID
    stripePaymentIntentId: `mock_pi_${Date.now()}`,
    amount: 400, // Matches pricing.total
    status: "succeeded", // Simulate a successful payment
  },
  status: 'confirmed', // Directly set status for testing
  source: 'test-button',
  notes: 'This is a test booking created via the development button.',
};

export function TestBookingButton() {
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setLoading(true);
    console.log("[TestBookingButton] Clicked! Attempting to create booking with mock data:", JSON.stringify(mockBookingData, null, 2));
    try {
      // Call the server action (createBooking)
      console.log("[TestBookingButton] Calling createBooking server action...");
      const bookingId = await createBooking(mockBookingData);
      console.log(`[TestBookingButton] createBooking action finished. Result Booking ID: ${bookingId}`);

      // Check if bookingId is actually returned
      if (bookingId) {
          console.log(`[TestBookingButton] Booking apparently created successfully! Booking ID: ${bookingId}`);
          toast({
            title: "Test Booking Successful",
            description: `Booking created in Firestore with ID: ${bookingId}`,
          });
      } else {
         // This case might happen if createBooking returns undefined/null on error, although it should throw
         console.error("[TestBookingButton] createBooking returned a falsy value, indicating a possible failure.", bookingId);
         toast({
            title: "Test Booking Possibly Failed",
            description: "The booking creation process completed but did not return a valid ID. Check server logs.",
            variant: "destructive",
          });
      }

    } catch (error) {
      // Catch errors thrown by the createBooking server action
      console.error("[TestBookingButton] Error caught from createBooking action:", error);
      toast({
        title: "Test Booking Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      console.log("[TestBookingButton] Finished handleClick execution.");
      setLoading(false);
    }
  };

  // Only render in development environment
  if (process.env.NODE_ENV !== 'development') {
    console.log("[TestBookingButton] Not rendering in non-development environment.");
    return null;
  }
  console.log("[TestBookingButton] Rendering button in development environment.");

  return (
    <div className="my-4 p-4 border rounded-md bg-secondary/30">
      <h3 className="text-lg font-semibold mb-2">Development Testing</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Click this button to create a test booking directly in Firestore, bypassing Stripe. Check the console (both browser and server terminal) and Firestore for results.
      </p>
      <Button onClick={handleClick} disabled={loading} variant="destructive">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
          </>
        ) : (
          'Create Test Booking in Firestore'
        )}
      </Button>
       <p className="text-xs text-muted-foreground mt-2">
        (Uses mock data for property `prop1`)
       </p>
    </div>
  );
}