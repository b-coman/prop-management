/**
 * @fileoverview Action buttons component for booking success page
 * @module app/booking/success/components/ActionButtons
 * @description Primary CTA button - back to property or complete booking for holds
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import type { Booking } from '@/types';

interface ActionButtonsProps {
  booking: Booking | null;
  bookingType: 'confirmed' | 'on-hold';
}

export function ActionButtons({
  booking,
  bookingType
}: ActionButtonsProps) {
  const { t } = useLanguage();
  const isHold = bookingType === 'on-hold';
  const propertyId = booking?.propertyId;

  return (
    <div className="flex flex-col w-full">
      {/* Primary CTA */}
      <Link href={isHold && propertyId
        ? `/booking/check/${propertyId}`
        : propertyId
          ? `/properties/${propertyId}`
          : '/properties'
      } className="w-full">
        <Button className="w-full min-h-[44px]">
          {isHold
            ? (propertyId
                ? t('booking.successPage.completeYourBooking')
                : t('booking.successPage.exploreProperties'))
            : (propertyId
                ? t('booking.successPage.backToProperty')
                : t('booking.successPage.exploreProperties'))}
        </Button>
      </Link>
    </div>
  );
}
