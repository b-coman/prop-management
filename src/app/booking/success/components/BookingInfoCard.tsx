/**
 * @fileoverview Unified booking info card component
 * @module app/booking/success/components/BookingInfoCard
 * @description Displays booking details including dates, guest info, property info, and pricing
 */

'use client';

import { Calendar, Users, Info, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/hooks/useLanguage';
import type { Booking, Property } from '@/types';
import { HoldExpirationBanner } from './HoldExpirationBanner';
import { PricingSummary } from './PricingSummary';
import { PaymentStatus } from './PaymentStatus';

interface BookingInfoCardProps {
  booking: Booking;
  property: Property | null;
  bookingType: 'confirmed' | 'on-hold';
  sessionId: string | null;
  verifying: boolean;
  onVerify: () => void;
}

// Helper to convert any date type to Date (handles Firestore Timestamps)
function toDate(date: any): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date?.toDate === 'function') return date.toDate(); // Firestore Timestamp
  if (typeof date === 'string' || typeof date === 'number') return new Date(date);
  return null;
}

export function BookingInfoCard({
  booking,
  property,
  bookingType,
  sessionId,
  verifying,
  onVerify
}: BookingInfoCardProps) {
  const { t, tc } = useLanguage();

  const formatDate = (date: any, formatString: string = 'MMM d, yyyy') => {
    const dateObj = toDate(date);
    if (!dateObj) return 'N/A';
    try {
      return format(dateObj, formatString);
    } catch (e) {
      return 'Invalid date';
    }
  };

  const isHold = bookingType === 'on-hold';

  // Get property name with multilanguage support
  const getPropertyName = () => {
    if (!property?.name) return '';
    if (typeof property.name === 'string') return property.name;
    return tc(property.name) || property.name.en || '';
  };

  return (
    <div className="space-y-4">
      {/* Dates grid - mobile: 1 col, sm+: 2 col */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-sm text-muted-foreground">{t('common.checkIn')}</h3>
            <p className="font-medium">{formatDate(booking.checkInDate)}</p>
            {(booking as any).checkInTime && (
              <p className="text-sm text-muted-foreground">After {(booking as any).checkInTime}</p>
            )}
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-sm text-muted-foreground">{t('common.checkOut')}</h3>
            <p className="font-medium">{formatDate(booking.checkOutDate)}</p>
            {(booking as any).checkOutTime && (
              <p className="text-sm text-muted-foreground">Before {(booking as any).checkOutTime}</p>
            )}
          </div>
        </div>
      </div>

      {/* Hold expiration banner - only for holds */}
      {isHold && booking.holdUntil && (
        <HoldExpirationBanner booking={booking} />
      )}

      {/* Guest info and booking ID - mobile: 1 col, sm+: 2 col */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-start space-x-3">
          <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-sm text-muted-foreground">
              {t('booking.successPage.guestInformation')}
            </h3>
            <p className="font-medium">{booking.guestInfo.firstName} {booking.guestInfo.lastName}</p>
            <p className="text-sm text-muted-foreground">
              {booking.numberOfGuests} {booking.numberOfGuests === 1
                ? t('booking.guest')
                : t('booking.guests')}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-sm text-muted-foreground">
              {isHold
                ? t('booking.successPage.holdInformation')
                : t('booking.successPage.bookingInformation')}
            </h3>
            <p className="text-sm">ID: <span className="font-medium">{booking.id}</span></p>
            <PaymentStatus
              booking={booking}
              verifying={verifying}
              onVerify={onVerify}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Pricing summary */}
      <PricingSummary booking={booking} bookingType={bookingType} />

      {/* Property info card */}
      {property && (
        <div className="p-4 bg-gray-50 border border-gray-100 rounded-md">
          <div className="flex items-start space-x-3">
            <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
              {property.images && property.images.length > 0 && property.images[0].url ? (
                <img
                  src={property.images[0].url}
                  alt={getPropertyName()}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                  {t('booking.successPage.noImage')}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium">{getPropertyName()}</h3>
              {property.location && (
                <p className="text-sm text-muted-foreground">
                  {property.location.city}{property.location.city && property.location.country && ", "}
                  {property.location.country}
                </p>
              )}
              {property.checkInTime && property.checkOutTime && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('common.checkIn')}: {property.checkInTime} · {t('common.checkOut')}: {property.checkOutTime}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment reference info */}
      {sessionId && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-700">
                {t('booking.successPage.paymentReference')}
              </h3>
              <p className="text-xs text-blue-600 mt-1">
                {t('booking.successPage.reference')}: {sessionId.substring(0, 15)}...
              </p>
              {booking.paymentInfo?.paidAt && (
                <p className="text-xs text-blue-600">
                  {t('booking.successPage.paidOn')}: {formatDate(booking.paymentInfo.paidAt, 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {booking.notes && (
        <div className="flex items-start space-x-3">
          <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">{t('booking.successPage.notes')}</h3>
            <p className="text-sm">{booking.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
