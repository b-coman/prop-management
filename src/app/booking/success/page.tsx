'use client'; // Needed for searchParams and useEffect

import { Suspense, useEffect, useState } from 'react'; // Added useEffect, useState
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/header';
import { simulateWebhookSuccess } from '@/app/actions/simulate-webhook-success'; // Import the simulation action
import { useToast } from '@/hooks/use-toast';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { toast } = useToast();

  // State for simulation status
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Run simulation only once on mount in development
  useEffect(() => {
    // Check if running in development and simulation hasn't run yet
    if (process.env.NODE_ENV === 'development' && simulationStatus === 'idle' && sessionId) {
      console.log('[Booking Success Page] Development mode detected. Attempting booking simulation...');
      setSimulationStatus('pending');

      // Extract necessary params from URL
      const params = {
        sessionId: sessionId,
        propertyId: searchParams.get('propId'),
        checkInDate: searchParams.get('checkIn'),
        checkOutDate: searchParams.get('checkOut'),
        numberOfGuests: searchParams.get('guests'),
        numberOfNights: searchParams.get('nights'),
        totalPrice: searchParams.get('total'),
        appliedCouponCode: searchParams.get('coupon') || undefined,
        discountPercentage: searchParams.get('discount') || undefined,
      };

      // Basic check for essential params
      if (!params.propertyId || !params.checkInDate || !params.checkOutDate || !params.numberOfGuests || !params.numberOfNights || !params.totalPrice) {
         console.error('[Booking Success Page] Missing required parameters in URL for simulation.');
         setSimulationError('Missing required parameters for simulation.');
         setSimulationStatus('error');
         toast({ title: "Simulation Error", description: "Missing required parameters in URL.", variant: "destructive" });
         return;
      }


      const simulate = async () => {
        try {
          const result = await simulateWebhookSuccess(params); // Call the server action

          if (result.success) {
            console.log('[Booking Success Page] Simulation successful. Booking ID:', result.bookingId);
            setSimulationStatus('success');
            toast({ title: "Booking Simulated", description: `(Dev Only) Booking ${result.bookingId} created in Firestore.` });
          } else {
            console.error('[Booking Success Page] Simulation failed:', result.error);
            setSimulationError(result.error || 'Unknown simulation error.');
            setSimulationStatus('error');
            toast({ title: "Simulation Failed", description: result.error || 'Could not simulate booking.', variant: "destructive" });
          }
        } catch (err) {
          console.error('[Booking Success Page] Error calling simulation action:', err);
          const message = err instanceof Error ? err.message : String(err);
          setSimulationError(`Action error: ${message}`);
          setSimulationStatus('error');
           toast({ title: "Simulation Action Error", description: message, variant: "destructive" });
        }
      };

      simulate();
    } else if (simulationStatus === 'idle' && !sessionId) {
        // Handle case where session ID is missing even outside dev
        setSimulationStatus('error');
        setSimulationError('Missing session ID.');
    } else if (simulationStatus === 'idle') {
        // In production or if simulation already attempted, just mark as idle (or maybe success if session ID exists?)
        // For now, let's assume webhook handles it in prod.
        setSimulationStatus('idle'); // Or 'success' if we assume webhook worked
    }

    // Disable exhaustive deps because we only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Dependency on sessionId ensures it runs when sessionId is available

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
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
             {/* Standard Success Message */}
             <p className="text-muted-foreground">
               Your booking has been processed. You should receive a confirmation email shortly (if email sending is implemented).
             </p>
             {/* Development Simulation Status */}
             {process.env.NODE_ENV === 'development' && (
                <div className="p-3 border rounded-md text-xs bg-muted/50">
                    <p className="font-semibold mb-1">Development Simulation Status:</p>
                    {simulationStatus === 'pending' && <div className="flex items-center text-muted-foreground"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Simulating booking creation...</div>}
                    {simulationStatus === 'success' && <div className="text-green-600">Booking successfully simulated in Firestore.</div>}
                    {simulationStatus === 'error' && <div className="text-destructive flex items-center"><AlertTriangle className="mr-1 h-3 w-3" /> Error simulating booking: {simulationError || 'Unknown error'}</div>}
                    {simulationStatus === 'idle' && <div className="text-muted-foreground">Webhook simulation did not run (not in dev mode or already attempted).</div>}
                </div>
             )}

             {sessionId && (
                 <p className="text-xs text-muted-foreground mt-2">
                    (Ref: {sessionId.substring(0, 15)}...) {/* Optionally display part of the session ID */}
                 </p>
             )}
             {/* Changed: Wrap Button inside Link */}
             <Link href="/properties">
               <Button className="w-full mt-6">Explore More Properties</Button>
             </Link>
          </CardContent>
        </Card>
      </main>
       {/* Optional simple footer */}
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

// Basic loading state for the page itself
function BookingSuccessLoading() {
   return (
     <div className="flex min-h-screen flex-col items-center justify-center">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="mt-4 text-muted-foreground">Loading confirmation...</p>
     </div>
   );
}