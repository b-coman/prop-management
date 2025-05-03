
'use client'; // Needed for searchParams

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

// No need to fetch session details client-side anymore.
// The booking creation logic is handled securely by the webhook.

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id'); // Can still get session ID for reference if needed

  // No loading/error state needed for session fetching
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
     // Remove the effect fetching session details
  // }, [sessionId]);

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
             {/* Simple success message */}
             <p className="text-muted-foreground">
               Your booking has been successfully processed and saved. You should receive a confirmation email shortly (if email sending is implemented).
             </p>
             {sessionId && (
                 <p className="text-xs text-muted-foreground mt-2">
                    (Ref: {sessionId.substring(0, 15)}...) {/* Optionally display part of the session ID */}
                 </p>
             )}
             <Button asChild className="w-full mt-6">
              <Link href="/properties">Explore More Properties</Link>
            </Button>
             {/* Optionally, add a link to a "My Bookings" page if implemented */}
             {/* <Button asChild variant="outline" className="w-full">
                <Link href="/my-bookings">View My Bookings</Link>
             </Button> */}
          </CardContent>
        </Card>
      </main>
      <Footer />
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
