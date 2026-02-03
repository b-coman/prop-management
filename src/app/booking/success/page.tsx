/**
 * @fileoverview Consolidated booking success page
 * @module app/booking/success/page
 * @description Handles both confirmed bookings and holds with unified design and theming
 */

'use client';

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Header } from '@/components/generic-header';
import { BookingProvider } from '@/contexts/BookingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/hooks/useLanguage';
import { getPropertyBySlug } from '@/lib/property-utils';
import {
  getBookingDetails,
  sendBookingConfirmationEmail,
  sendHoldConfirmationEmail,
  verifyAndUpdateBooking
} from './actions';
import type { Booking, Property } from '@/types';
import {
  SuccessHeader,
  StatusMessage,
  BookingInfoCard,
  ActionButtons,
  type StatusMessageData
} from './components';
import BookingSuccessClient from './booking-success-client';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');
  const typeParam = searchParams.get('type'); // Optional type hint from redirect
  const { setTheme } = useTheme();
  const { t, tc } = useLanguage();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessageData | null>(null);

  // Determine booking type from status field or holdUntil presence
  const bookingType = useMemo(() => {
    if (typeParam === 'hold') return 'on-hold';
    if (booking?.status === 'on-hold' || booking?.holdUntil) return 'on-hold';
    return 'confirmed';
  }, [booking, typeParam]);

  // Apply property theme when property is loaded
  useEffect(() => {
    if (property?.themeId) {
      console.log(`🎨 [BookingSuccess] Applying property theme: ${property.themeId}`);
      setTheme(property.themeId);
    }
  }, [property, setTheme]);

  // Verify booking status with Stripe
  const verifyBookingStatus = useCallback(async () => {
    if (!sessionId || !bookingId) {
      setStatusMessage({
        type: 'error',
        message: t('booking.successPage.missingSessionInfo')
      });
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyAndUpdateBooking(sessionId, bookingId);

      if (result.success) {
        if (result.updated) {
          setStatusMessage({
            type: 'success',
            message: t('booking.successPage.bookingVerifiedSuccess')
          });

          if (result.booking) {
            setBooking(result.booking);
          } else {
            const refreshedBooking = await getBookingDetails(bookingId);
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
      } else {
        setStatusMessage({
          type: 'error',
          message: result.message
        });
      }
    } catch (err) {
      console.error('Error verifying booking status:', err);
      setStatusMessage({
        type: 'error',
        message: t('booking.successPage.verificationError')
      });
    } finally {
      setVerifying(false);
    }
  }, [sessionId, bookingId, t]);

  // Load booking and property details
  useEffect(() => {
    async function loadBookingDetails() {
      if (!bookingId) {
        setLoading(false);
        setError(t('booking.successPage.noBookingIdError'));
        return;
      }

      try {
        const bookingData = await getBookingDetails(bookingId);

        if (bookingData) {
          setBooking(bookingData);

          // Fetch property details if available
          if (bookingData.propertyId) {
            try {
              const propertyData = await getPropertyBySlug(bookingData.propertyId);
              setProperty(propertyData);
            } catch (propErr) {
              console.error('Error fetching property details:', propErr);
            }
          }

          // Auto-verify if payment not yet confirmed and we have session ID
          const isHold = bookingData.status === 'on-hold' || !!bookingData.holdUntil;
          const needsVerification = isHold
            ? (!bookingData.holdPaymentId || bookingData.paymentInfo?.status !== 'succeeded')
            : bookingData.paymentInfo?.status !== 'succeeded';

          if (sessionId && needsVerification) {
            console.log('🔄 Automatically verifying booking payment status...');
            await verifyBookingStatus();
          }
        } else {
          console.warn(`No booking data found for ID: ${bookingId}`);
          setError(t('booking.successPage.limitedInfoAvailable'));
        }
      } catch (err) {
        console.error('Error fetching booking details:', err);
        setError(t('booking.successPage.loadError'));
      } finally {
        setLoading(false);
      }
    }

    loadBookingDetails();
  }, [bookingId, sessionId, verifyBookingStatus, t]);

  // Handle sending confirmation email
  const handleSendEmail = async () => {
    if (!booking) return;

    setSendingEmail(true);
    try {
      const sendFn = bookingType === 'on-hold'
        ? sendHoldConfirmationEmail
        : sendBookingConfirmationEmail;

      const result = await sendFn(booking.id);

      if (result.success) {
        if (result.previewUrl) {
          window.open(result.previewUrl, '_blank');
        }
        setStatusMessage({
          type: 'success',
          message: t('booking.successPage.emailSentSuccess')
        });
      } else {
        setStatusMessage({
          type: 'error',
          message: t('booking.successPage.emailSentError', '', { error: result.message })
        });
      }
    } catch (err) {
      console.error('Error sending confirmation email:', err);
      setStatusMessage({
        type: 'error',
        message: t('booking.successPage.emailSendError')
      });
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">
          {bookingType === 'on-hold'
            ? t('booking.successPage.loadingHoldDetails')
            : t('booking.successPage.loadingBookingDetails')}
        </p>
      </div>
    );
  }

  // Get property name with multilanguage support
  const getPropertyName = () => {
    if (!property?.name) {
      if (booking?.propertyId) {
        const typeLabel = bookingType === 'on-hold'
          ? t('booking.successPage.holdInformation')
          : t('booking.successPage.bookingInformation');
        return `${typeLabel} - ${booking.propertyId}`;
      }
      return bookingType === 'on-hold'
        ? t('booking.successPage.datesOnHoldTitle')
        : t('booking.successPage.bookingConfirmedTitle');
    }
    if (typeof property.name === 'string') return property.name;
    return tc(property.name) || property.name.en || '';
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        propertyName={getPropertyName()}
        propertySlug={booking?.propertyId || ''}
      />

      <main className="flex-grow container py-12 md:py-16 lg:py-20 flex items-center justify-center">
        <Card className="w-full max-w-2xl shadow-xl">
          <SuccessHeader bookingType={bookingType} />

          <StatusMessage
            statusMessage={statusMessage}
            onDismiss={() => setStatusMessage(null)}
          />

          <CardContent className="space-y-6">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                {error}
              </div>
            ) : (
              <>
                {booking && (
                  <BookingInfoCard
                    booking={booking}
                    property={property}
                    bookingType={bookingType}
                    sessionId={sessionId}
                    verifying={verifying}
                    onVerify={verifyBookingStatus}
                  />
                )}

                {!booking && !error && (
                  <p className="text-center text-muted-foreground">
                    {t('booking.successPage.bookingProcessed', '', {
                      type: bookingType === 'on-hold' ? 'hold' : 'booking',
                      id: bookingId || 'N/A'
                    })}
                  </p>
                )}
              </>
            )}
          </CardContent>

          <CardFooter className="pt-2">
            <ActionButtons
              booking={booking}
              bookingType={bookingType}
              onSendEmail={handleSendEmail}
              sendingEmail={sendingEmail}
            />
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

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<BookingSuccessLoading />}>
      <BookingProvider>
        <BookingSuccessClient>
          <BookingSuccessContent />
        </BookingSuccessClient>
      </BookingProvider>
    </Suspense>
  );
}

function BookingSuccessLoading() {
  // Can't use hooks here as it's outside providers, so use a simple fallback
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading confirmation...</p>
    </div>
  );
}
