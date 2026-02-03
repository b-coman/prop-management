/**
 * @fileoverview Action buttons component with 3-tier CTA hierarchy
 * @module app/booking/success/components/ActionButtons
 * @description Primary, secondary, and tertiary action buttons for success page
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import type { Booking } from '@/types';

interface ActionButtonsProps {
  booking: Booking | null;
  bookingType: 'confirmed' | 'on-hold';
  onSendEmail: () => void;
  sendingEmail: boolean;
}

export function ActionButtons({
  booking,
  bookingType,
  onSendEmail,
  sendingEmail
}: ActionButtonsProps) {
  const { t } = useLanguage();
  const isHold = bookingType === 'on-hold';
  const propertyId = booking?.propertyId;

  return (
    <div className="flex flex-col space-y-3 w-full">
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

      {/* Secondary CTA - Send email */}
      {booking && (
        <Button
          variant="outline"
          className="w-full min-h-[44px]"
          onClick={onSendEmail}
          disabled={sendingEmail}
        >
          {sendingEmail
            ? t('booking.successPage.sending')
            : t('booking.successPage.sendConfirmationEmail')}
        </Button>
      )}

      {/* Tertiary CTA - View property */}
      {propertyId && (
        <Link href={`/properties/${propertyId}`} className="w-full">
          <Button variant="ghost" className="w-full min-h-[44px] text-muted-foreground hover:text-foreground">
            {t('booking.successPage.viewPropertyDetails')}
          </Button>
        </Link>
      )}
    </div>
  );
}
