/**
 * @fileoverview Success page header component with icon and title
 * @module app/booking/success/components/SuccessHeader
 * @description Renders the success header with appropriate icon and message based on booking type
 */

'use client';

import { CheckCircle, Clock } from 'lucide-react';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/hooks/useLanguage';

interface SuccessHeaderProps {
  bookingType: 'confirmed' | 'on-hold';
}

export function SuccessHeader({ bookingType }: SuccessHeaderProps) {
  const { t } = useLanguage();
  const isHold = bookingType === 'on-hold';

  return (
    <CardHeader>
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
        isHold ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
      }`}>
        {isHold ? (
          <Clock className="h-10 w-10" />
        ) : (
          <CheckCircle className="h-10 w-10" />
        )}
      </div>
      <CardTitle className="text-2xl sm:text-3xl font-bold text-center">
        {isHold
          ? t('booking.successPage.datesOnHoldTitle')
          : t('booking.successPage.bookingConfirmedTitle')}
      </CardTitle>
      <CardDescription className="text-center">
        {isHold
          ? t('booking.successPage.datesOnHoldDescription')
          : t('booking.successPage.bookingConfirmedDescription')}
      </CardDescription>
    </CardHeader>
  );
}
