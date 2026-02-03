/**
 * @fileoverview Payment status badge with verification button
 * @module app/booking/success/components/PaymentStatus
 * @description Shows payment status and allows manual verification
 */

'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import type { Booking } from '@/types';

interface PaymentStatusProps {
  booking: Booking;
  verifying: boolean;
  onVerify: () => void;
}

export function PaymentStatus({ booking, verifying, onVerify }: PaymentStatusProps) {
  const { t } = useLanguage();
  const isPaymentConfirmed = booking.paymentInfo?.status === 'succeeded';

  return (
    <div className="mt-2 flex items-center flex-wrap gap-2">
      <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
        isPaymentConfirmed
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-amber-100 text-amber-800 border border-amber-200'
      }`}>
        {isPaymentConfirmed
          ? t('booking.successPage.paymentConfirmed')
          : t('booking.successPage.paymentProcessing')}
      </span>

      {!isPaymentConfirmed && (
        <button
          className="text-primary hover:text-primary/80 inline-flex items-center text-xs min-h-[44px] min-w-[44px] px-2"
          onClick={onVerify}
          disabled={verifying}
        >
          {verifying ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {t('booking.successPage.verifying')}
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('booking.successPage.verifyStatus')}
            </>
          )}
        </button>
      )}
    </div>
  );
}
