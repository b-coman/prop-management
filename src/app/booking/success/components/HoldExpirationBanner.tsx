/**
 * @fileoverview Hold expiration warning banner
 * @module app/booking/success/components/HoldExpirationBanner
 * @description Amber warning banner showing hold expiration time
 */

'use client';

import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/hooks/useLanguage';
import type { Booking } from '@/types';

interface HoldExpirationBannerProps {
  booking: Booking;
}

export function HoldExpirationBanner({ booking }: HoldExpirationBannerProps) {
  const { t } = useLanguage();

  const calculateHoldUntil = () => {
    if (!booking.holdUntil) return 'N/A';

    try {
      const holdUntilDate = booking.holdUntil instanceof Date
        ? booking.holdUntil
        : (booking.holdUntil as any)?.toDate
          ? (booking.holdUntil as any).toDate()
          : new Date(booking.holdUntil as string);

      return format(holdUntilDate, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="flex items-start space-x-3 p-4 border border-amber-200 bg-amber-50 rounded-md">
      <Clock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-medium text-amber-700">
          {t('booking.successPage.holdExpires')}
        </h3>
        <p className="font-medium text-amber-900">{calculateHoldUntil()}</p>
        <p className="text-sm text-amber-600 mt-1">
          {t('booking.successPage.completeBeforeExpiration')}
        </p>
      </div>
    </div>
  );
}
