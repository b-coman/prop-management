/**
 * @fileoverview Pricing summary component for bookings
 * @module app/booking/success/components/PricingSummary
 * @description Full pricing breakdown for confirmed bookings, hold fee only for holds
 */

'use client';

import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/hooks/useLanguage';
import type { Booking } from '@/types';

interface PricingSummaryProps {
  booking: Booking;
  bookingType: 'confirmed' | 'on-hold';
}

export function PricingSummary({ booking, bookingType }: PricingSummaryProps) {
  const { t } = useLanguage();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const isHold = bookingType === 'on-hold';

  if (isHold) {
    // For holds, show only the hold fee
    const holdFee = booking.paymentInfo?.amount || booking.holdFee || 0;
    const currency = booking.pricing?.currency || 'EUR';

    return (
      <div>
        <h3 className="font-medium mb-2">{t('booking.successPage.paymentDetails')}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>{t('booking.successPage.holdFee')}</span>
            <span>{formatCurrency(holdFee, currency)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium">
            <span>{t('booking.successPage.totalPaid')}</span>
            <span className="text-primary">{formatCurrency(holdFee, currency)}</span>
          </div>
        </div>
        <p className="text-xs text-amber-600 mt-3">
          {(booking as any).holdFeeRefundable
            ? t('booking.successPage.holdFeeRefundableNote')
            : t('booking.successPage.holdFeeNonRefundableNote')}
        </p>
      </div>
    );
  }

  // For confirmed bookings, show full breakdown
  const nightLabel = booking.pricing.numberOfNights === 1
    ? t('common.night')
    : t('common.nights');

  return (
    <div>
      <h3 className="font-medium mb-2">{t('booking.successPage.bookingSummary')}</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>
            {t('booking.successPage.baseRate', '', {
              nights: booking.pricing.numberOfNights,
              nightLabel
            })}
          </span>
          <span>{formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency)}</span>
        </div>

        <div className="flex justify-between">
          <span>{t('booking.cleaningFee')}</span>
          <span>{formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency)}</span>
        </div>

        {(booking.pricing.extraGuestFee ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>
              {t('booking.successPage.extraGuestFee', '', {
                count: booking.pricing.numberOfExtraGuests || 0
              })}
            </span>
            <span>{formatCurrency(booking.pricing.extraGuestFee!, booking.pricing.currency)}</span>
          </div>
        )}

        {(booking.pricing.taxes ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>{t('booking.taxes')}</span>
            <span>{formatCurrency(booking.pricing.taxes!, booking.pricing.currency)}</span>
          </div>
        )}

        {(booking.pricing.discountAmount ?? 0) > 0 && (
          <div className="flex justify-between text-green-600">
            <span>
              {t('booking.successPage.discount')} {booking.appliedCouponCode && `(${booking.appliedCouponCode})`}
            </span>
            <span>-{formatCurrency(booking.pricing.discountAmount!, booking.pricing.currency)}</span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between font-medium">
          <span>{t('common.total')}</span>
          <span>{formatCurrency(booking.pricing.total, booking.pricing.currency)}</span>
        </div>
      </div>
    </div>
  );
}
