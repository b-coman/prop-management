
'use client'; // Needed for searchParams

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import Stripe from 'stripe';

// Note: Retrieving session details client-side like this is generally discouraged
// for sensitive actions like fulfilling orders, as client-side data can be manipulated.
// In a production app, you'd typically use Stripe webhooks on your server to:
// 1. Confirm the payment was successful (`checkout.session.completed` event).
// 2. Retrieve session details securely.
// 3. Update your database (create the booking record, mark property as unavailable).
// 4. Send confirmation emails.
// This client-side retrieval is for display purposes only.

// Function to fetch session details (NEEDS a server action or API route for security)
// Example: You'd create `/api/get-stripe-session?session_id=...`
async function fetchSessionDetails(sessionId: string | null): Promise<Stripe.Checkout.Session | null> {
  if (!sessionId) return null;
  try {
    // IMPORTANT: Replace this fetch with a call to your secure backend endpoint
    // that verifies the session and fetches details using your secret key.
    const response = await fetch(`/api/get-stripe-session?session_id=${sessionId}`); // Placeholder API route
    if (!response.ok) {
      throw new Error('Failed to fetch session details');
    }
    const sessionData = await response.json();
    return sessionData as Stripe.Checkout.Session;
  } catch (error) {
    console.error("Error fetching Stripe session:", error);
    return null;
  }
}


function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [session, setSession] = useState<Stripe.Checkout.Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID found.");
      setLoading(false);
      return;
    }

    // In a real app, call your secure backend endpoint here
    // fetchSessionDetails(sessionId).then(data => {
    //   if (data) {
    //     setSession(data);
    //     // TODO: Call another backend function here to *actually* create
    //     // the booking record in your database using the session metadata,
    //     // but ONLY if the payment status is 'paid'.
    //     // Never rely solely on the success page visit to create bookings.
    //     // Use webhooks (`checkout.session.completed`).
    //   } else {
    //     setError("Could not retrieve booking details.");
    //   }
    //   setLoading(false);
    // }).catch(err => {
    //   setError("An error occurred while fetching booking details.");
    //   console.error(err);
    //   setLoading(false);
    // });

    // --- Placeholder for demonstration without backend ---
    // Simulate fetching data based on metadata (normally fetched securely)
    // THIS IS NOT SECURE FOR PRODUCTION - USE WEBHOOKS
    console.warn("Displaying placeholder success message. Implement secure webhook handling and backend session retrieval for production.");
    setLoading(false);
    // You *could* try to parse metadata passed back in the URL, but it's not recommended.
    // For demo, we'll just show a generic success message.

  }, [sessionId]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow container py-12 md:py-16 lg:py-20 flex items-center justify-center">
        <Card className="w-full max-w-lg text-center shadow-xl">
          <CardHeader>
             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
               <CheckCircle className="h-10 w-10" />
             </div>
            <CardTitle className="text-3xl font-bold">Booking Successful!</CardTitle>
            <CardDescription>
              Thank you for your booking. Your payment has been processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading && (
              <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading booking details...</span>
              </div>
            )}
            {error && (
               <p className="text-destructive">{error}</p>
            )}
             {!loading && !error && (
               <>
                 {/* Placeholder Content - Replace with actual details from secure source */}
                 <p className="text-muted-foreground">
                   A confirmation email has been sent (or would be in a real app!).
                   You can view your booking details in your account area (if implemented).
                 </p>
                {/* {session && session.metadata && (
                   <div className="text-left text-sm space-y-2 border p-4 rounded-md bg-secondary/50">
                     <p><strong>Property:</strong> {session.metadata.propertyName || 'N/A'}</p>
                     <p><strong>Check-in:</strong> {session.metadata.checkInDate ? new Date(session.metadata.checkInDate).toLocaleDateString() : 'N/A'}</p>
                     <p><strong>Check-out:</strong> {session.metadata.checkOutDate ? new Date(session.metadata.checkOutDate).toLocaleDateString() : 'N/A'}</p>
                     <p><strong>Guests:</strong> {session.metadata.numberOfGuests || 'N/A'}</p>
                     <p><strong>Total Paid:</strong> ${session.metadata.totalPrice ? parseFloat(session.metadata.totalPrice).toFixed(2) : 'N/A'}</p>
                     <p className="text-xs text-muted-foreground mt-2">Session ID: {sessionId}</p>
                   </div>
                 )} */}
                 <Button asChild className="w-full mt-6">
                  <Link href="/properties">Explore More Properties</Link>
                </Button>
               </>
             )}

          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}


// Wrap the component in Suspense to handle asynchronous data fetching/searchParams
export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<BookingSuccessLoading />}>
      <BookingSuccessContent />
    </Suspense>
  )
}

// Basic loading state for the page itself
function BookingSuccessLoading() {
   return (
     <div className="flex min-h-screen flex-col items-center justify-center">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="mt-4 text-muted-foreground">Loading booking confirmation...</p>
     </div>
   );
}
