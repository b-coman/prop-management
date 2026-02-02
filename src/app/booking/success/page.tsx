
'use client'; // Needed for searchParams

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2, Calendar, Users, Info, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { SuccessAnimation } from '@/components/ui/interaction-feedback';
import { Header } from '@/components/generic-header';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { getBookingDetails, sendBookingConfirmationEmail } from './actions';
import type { Booking, Property } from '@/types';
import { getPropertyBySlug } from '@/lib/property-utils';
import { useTheme } from '@/contexts/ThemeContext';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');
  const { setTheme } = useTheme();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply property theme when property is loaded
  useEffect(() => {
    if (property?.themeId) {
      console.log(`🎨 [BookingSuccess] Applying property theme: ${property.themeId}`);
      setTheme(property.themeId);
    }
  }, [property, setTheme]);

  useEffect(() => {
    async function loadBookingDetails() {
      if (!bookingId) {
        setLoading(false);
        setError("No booking ID found");
        return;
      }

      try {
        const bookingData = await getBookingDetails(bookingId);

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
        } else {
          // If booking data is null (could be due to permissions or not found)
          console.warn(`No booking data found for ID: ${bookingId}`);
          setError("Limited booking information available");
        }
      } catch (err) {
        console.error("Error fetching booking details:", err);
        setError("Could not load booking details. Please contact support.");
      } finally {
        setLoading(false);
      }
    }

    loadBookingDetails();
  }, [bookingId]);

  // Format dates for display
  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return format(dateObj, 'MMM d, yyyy');
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
        <p className="mt-4 text-muted-foreground">Loading booking details...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        propertyName={typeof property?.name === 'string' ? property.name : property?.name?.en || (booking?.propertyId ? `Booking for ${booking.propertyId}` : "Booking Confirmation")}
        propertySlug={booking?.propertyId || ""}
      />

      <main className="flex-grow container py-12 md:py-16 lg:py-20 flex items-center justify-center">
        <SuccessAnimation show={true} />
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle className="h-10 w-10" />
            </div>
            <CardTitle className="text-3xl font-bold text-center">Booking Confirmed!</CardTitle>
            <CardDescription className="text-center">
              Thank you for your booking. Your payment was successful.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                {error}
              </div>
            ) : (
              <>
                {booking && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start space-x-3">
                        <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium">Check-in</h3>
                          <p>{formatDate(booking.checkInDate)}</p>
                          {(booking as any).checkInTime && <p className="text-sm text-muted-foreground">After {(booking as any).checkInTime}</p>}
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium">Check-out</h3>
                          <p>{formatDate(booking.checkOutDate)}</p>
                          {(booking as any).checkOutTime && <p className="text-sm text-muted-foreground">Before {(booking as any).checkOutTime}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium">Guest Information</h3>
                        <p>{booking.guestInfo.firstName} {booking.guestInfo.lastName}</p>
                        <p className="text-sm">{booking.numberOfGuests} {booking.numberOfGuests === 1 ? 'guest' : 'guests'}</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-medium mb-2">Booking Summary</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Base rate ({booking.pricing.numberOfNights} {booking.pricing.numberOfNights === 1 ? 'night' : 'nights'})</span>
                          <span>{formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency)}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Cleaning fee</span>
                          <span>{formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency)}</span>
                        </div>

                        {(booking.pricing.extraGuestFee ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Extra guest fee ({booking.pricing.numberOfExtraGuests || 0} guests)</span>
                            <span>{formatCurrency(booking.pricing.extraGuestFee!, booking.pricing.currency)}</span>
                          </div>
                        )}

                        {(booking.pricing.taxes ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Taxes</span>
                            <span>{formatCurrency(booking.pricing.taxes!, booking.pricing.currency)}</span>
                          </div>
                        )}

                        {(booking.pricing.discountAmount ?? 0) > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount {booking.appliedCouponCode && `(${booking.appliedCouponCode})`}</span>
                            <span>-{formatCurrency(booking.pricing.discountAmount!, booking.pricing.currency)}</span>
                          </div>
                        )}

                        <Separator />

                        <div className="flex justify-between font-medium">
                          <span>Total</span>
                          <span>{formatCurrency(booking.pricing.total, booking.pricing.currency)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Property information card */}
                    {property && (
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-md">
                        <div className="flex items-start space-x-3">
                          <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
                            {property.images && property.images.length > 0 && property.images[0].url ? (
                              <img
                                src={property.images[0].url}
                                alt={typeof property.name === 'string' ? property.name : property.name.en}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                No image
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium">{typeof property.name === 'string' ? property.name : property.name.en}</h3>
                            {property.location && (
                              <p className="text-sm text-muted-foreground">
                                {property.location.city}{property.location.city && property.location.country && ", "}
                                {property.location.country}
                              </p>
                            )}
                            {property.checkInTime && property.checkOutTime && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Check-in: {property.checkInTime} · Check-out: {property.checkOutTime}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
                      <div className="flex items-start space-x-3">
                        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-blue-700">Booking Information</h3>
                          <p className="text-sm text-blue-600">Your booking ID: <span className="font-medium">{booking.id}</span></p>
                          {sessionId && (
                            <p className="text-xs text-blue-600 mt-1">
                              Payment Reference: {sessionId.substring(0, 15)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {booking.notes && (
                      <div className="flex items-start space-x-3">
                        <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium">Notes</h3>
                          <p className="text-sm">{booking.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!booking && !error && (
                  <p className="text-center text-muted-foreground">
                    Your booking (ID: {bookingId || 'N/A'}) has been processed. You should receive a confirmation email shortly.
                  </p>
                )}

                {error && (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start space-x-3">
                        <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-amber-700">Booking Confirmation</h3>
                          <p className="text-sm text-amber-600">
                            Your booking (ID: {bookingId || 'N/A'}) has been processed successfully!
                            We're unable to display full details at this moment, but your reservation is confirmed.
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

          <CardFooter className="flex flex-col space-y-3">
            <Link href={booking?.propertyId ? `/properties/${booking.propertyId}` : "/properties"} className="w-full">
              <Button className="w-full">
                {booking?.propertyId ? 'Back to Property' : 'Explore Properties'}
              </Button>
            </Link>

            {booking && (
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    const result = await sendBookingConfirmationEmail(booking.id);
                    if (result.success) {
                      // We can use window.open to show email preview in dev environments
                      if (result.previewUrl) {
                        window.open(result.previewUrl, '_blank');
                      }
                      alert("Confirmation email sent successfully!");
                    } else {
                      alert(`Failed to send email: ${result.message}`);
                    }
                  } catch (err) {
                    console.error("Error sending confirmation email:", err);
                    alert("Error sending confirmation email. Please try again.");
                  }
                }}
              >
                Send Confirmation Email
              </Button>
            )}
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
import BookingSuccessClient from './booking-success-client';

// Wrap the component in Suspense to handle searchParams
export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<BookingSuccessLoading />}>
      <BookingProvider>
        <BookingSuccessClient>
          <BookingSuccessContent />
        </BookingSuccessClient>
      </BookingProvider>
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
