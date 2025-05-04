
 'use client'; // Needed for searchParams

import { Suspense, useEffect } from 'react'; // Removed useState
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2 } from 'lucide-react'; // Removed AlertTriangle
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/generic-header'; // Corrected import path
// Removed simulation action import: import { simulateWebhookSuccess } from '@/app/actions/simulate-webhook-success';
// Removed useToast import: import { useToast } from '@/hooks/use-toast';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id'); // Get booking ID if passed

  // Removed simulation state and useEffect for simulation

  return (
    <div className="flex min-h-screen flex-col">
      {/* Use Generic Header - Note: generic header requires propertyName and propertySlug,
          which are not available on this page. Consider creating a simpler header or fetching data.
          For now, providing placeholder values, but this should be reviewed. */}
      <Header propertyName="Booking Confirmation" propertySlug="" />
      <main className="flex-grow container py-12 md:py-16 lg:py-20 flex items-center justify-center">
        <Card className="w-full max-w-lg text-center shadow-xl">
          <CardHeader>
             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
               <CheckCircle className="h-10 w-10" />
             </div>
            <CardTitle className="text-3xl font-bold">Booking Confirmed!</CardTitle>
            <CardDescription>
              Thank you for your booking. Your payment was successful.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <p className="text-muted-foreground">
               Your booking (ID: {bookingId || 'N/A'}) has been processed. You should receive a confirmation email shortly (if implemented).
             </p>

             {sessionId && (
                 <p className="text-xs text-muted-foreground mt-2">
                    (Payment Ref: {sessionId.substring(0, 15)}...)
                 </p>
             )}
             {/* TODO: Add link to view booking details if user is logged in */}
             {/* {bookingId && <Link href={`/my-bookings/${bookingId}`}><Button variant="outline">View Booking</Button></Link>} */}

             <Link href="/properties">
               <Button className="w-full mt-6">Explore More Properties</Button>
             </Link>
          </CardContent>
        </Card>
      </main>
        <footer className="border-t bg-muted/50">
            <div className="container py-4 text-center text-xs text-muted-foreground">
                RentalSpot &copy; {new Date().getFullYear()}
            </div>
        </footer>
    </div>
  );
}

// Wrap the component in Suspense to handle searchParams
export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<BookingSuccessLoading />}>
      <BookingSuccessContent />
    </Suspense>
  )
}

// Basic loading state
function BookingSuccessLoading() {
   return (
     <div className="flex min-h-screen flex-col items-center justify-center">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="mt-4 text-muted-foreground">Loading confirmation...</p>
     </div>
   );
}
