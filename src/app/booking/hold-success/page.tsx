'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { SuccessAnimation } from '@/components/ui/interaction-feedback';
import { Header } from '@/components/generic-header';
import { format } from 'date-fns';
import { getHoldBookingDetails, sendHoldConfirmationEmail, verifyAndUpdateHoldBooking } from './actions';
import type { Booking, Property } from '@/types';
import { getPropertyBySlug } from '@/lib/property-utils';
import { ConsolidatedInfoCard } from './consolidated-info-card';

function HoldSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Function to handle manual verification of booking/payment status
  const verifyBookingStatus = async () => {
    if (!sessionId || !bookingId) {
      setStatusMessage({
        type: 'error',
        message: "Missing session or booking information"
      });
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyAndUpdateHoldBooking(sessionId, bookingId);
      
      if (result.success) {
        if (result.updated) {
          setStatusMessage({
            type: 'success',
            message: "Your booking has been verified and updated successfully"
          });
          
          // If the booking was updated, refresh our local state
          if (result.booking) {
            setBooking(result.booking);
          } else {
            // If no booking in the result but it was successful, refetch
            const refreshedBooking = await getHoldBookingDetails(bookingId);
            if (refreshedBooking) {
              setBooking(refreshedBooking);
            }
          }
        } else {
          setStatusMessage({
            type: 'success',
            message: result.message
          });
        }
        setVerified(true);
      } else {
        setStatusMessage({
          type: 'error',
          message: result.message
        });
      }
    } catch (err) {
      console.error("Error verifying booking status:", err);
      setStatusMessage({
        type: 'error',
        message: "An error occurred while verifying your booking"
      });
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    async function loadBookingDetails() {
      if (!bookingId) {
        setLoading(false);
        setError("No booking ID found");
        return;
      }

      try {
        const bookingData = await getHoldBookingDetails(bookingId);

        if (bookingData) {
          setBooking(bookingData);

          // If we have booking data with a property ID, fetch property details
          if (bookingData.propertyId) {
            try {
              const propertyData = await getPropertyBySlug(bookingData.propertyId);
              setProperty(propertyData);
            } catch (propErr) {
              console.error("Error fetching property details:", propErr);
              // Don't set an error - we can still show booking info without property details
            }
          }
          
          // If booking payment status is pending and we have a session ID, verify it
          if (
            sessionId && 
            (!bookingData.holdPaymentId || bookingData.paymentInfo?.status !== 'succeeded')
          ) {
            // Automatically verify the booking if it doesn't look like the webhook processed it
            console.log("🔄 Automatically verifying booking payment status...");
            await verifyBookingStatus();
          }
        } else {
          // If booking data is null (could be due to permissions or not found)
          console.warn(`No booking data found for ID: ${bookingId}`);
          setError("Limited booking information available");
        }
      } catch (err) {
        console.error("Error fetching hold booking details:", err);
        setError("Could not load hold booking details. Please contact support.");
      } finally {
        setLoading(false);
      }
    }

    loadBookingDetails();
  }, [bookingId, sessionId]);

  // Format dates for display
  const formatDate = (date: any, formatString: string = 'MMM d, yyyy') => {
    if (!date) return 'N/A';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return format(dateObj, formatString);
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading hold details...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        propertyName={typeof property?.name === 'string' ? property.name : property?.name?.en || (booking?.propertyId ? `Hold for ${booking.propertyId}` : "Hold Confirmation")}
        propertySlug={booking?.propertyId || ""}
      />

      <main className="flex-grow container py-12 md:py-16 lg:py-20 flex items-center justify-center">
        <SuccessAnimation show={true} />
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-semibold text-center">Dates On Hold!</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Your selected dates have been successfully held and your payment has been processed.
            </CardDescription>
          </CardHeader>

          {/* Status message display */}
          {statusMessage && (
            <div className={`mx-6 mb-6 p-4 rounded-md flex items-start ${
              statusMessage.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">{statusMessage.message}</div>
            </div>
          )}

          <CardContent className="space-y-6">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                {error}
              </div>
            ) : (
              <>
                {booking && (
                  <ConsolidatedInfoCard
                    booking={booking}
                    property={property}
                    sessionId={sessionId}
                    verifying={verifying}
                    verifyBookingStatus={verifyBookingStatus}
                  />
                )}

                {!booking && !error && (
                  <p className="text-center text-muted-foreground">
                    Your hold (ID: {bookingId || 'N/A'}) has been processed. You should receive a confirmation email shortly.
                  </p>
                )}

                {error && (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-amber-700">Hold Confirmation</h3>
                          <p className="text-sm text-amber-600">
                            Your hold (ID: {bookingId || 'N/A'}) has been processed successfully!
                            We're unable to display full details at this moment, but your dates are held.
                            A confirmation email with all details will be sent to you shortly.
                          </p>
                          {sessionId && (
                            <p className="text-xs text-amber-600 mt-1">
                              Payment Reference: {sessionId.substring(0, 15)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Link href={booking?.propertyId ? `/booking/check/${booking.propertyId}` : "/properties"} className="w-full">
              <Button className="w-full transition-all hover:bg-primary/90">
                {booking?.propertyId ? 'Complete Your Booking' : 'Explore Properties'}
              </Button>
            </Link>

            {booking && (
              <Button
                variant="outline"
                className="w-full border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
                onClick={async () => {
                  try {
                    const result = await sendHoldConfirmationEmail(booking.id);
                    if (result.success) {
                      // We can use window.open to show email preview in dev environments
                      if (result.previewUrl) {
                        window.open(result.previewUrl, '_blank');
                      }
                      setStatusMessage({
                        type: 'success',
                        message: "Confirmation email sent successfully!"
                      });
                    } else {
                      setStatusMessage({
                        type: 'error',
                        message: `Failed to send email: ${result.message}`
                      });
                    }
                  } catch (err) {
                    console.error("Error sending hold confirmation email:", err);
                    setStatusMessage({
                      type: 'error',
                      message: "Error sending confirmation email. Please try again."
                    });
                  }
                }}
              >
                Send Confirmation Email
              </Button>
            )}

            <Link href={booking?.propertyId ? `/properties/${booking.propertyId}` : "/properties"} className="w-full">
              <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/50">
                View Property Details
              </Button>
            </Link>
          </CardFooter>
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

// Import BookingProvider and our client component
import { BookingProvider } from '@/contexts/BookingContext';
import HoldSuccessClient from './hold-success-client';

// Wrap the component in Suspense to handle searchParams
export default function HoldSuccessPage() {
  return (
    <Suspense fallback={<HoldSuccessLoading />}>
      <BookingProvider>
        <HoldSuccessClient>
          <HoldSuccessContent />
        </HoldSuccessClient>
      </BookingProvider>
    </Suspense>
  )
}

// Basic loading state
function HoldSuccessLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading confirmation...</p>
    </div>
  );
}