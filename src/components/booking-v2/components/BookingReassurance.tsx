/**
 * BookingReassurance — the three things a Booking.com listing says and this page did not.
 *
 * WHY. Measured 24 Aug - 9 Sep: 53 people were shown a real, bookable total here and none typed a
 * character. Average time on the page, mobile, 25 seconds. The page opened on "Finalizează
 * rezervarea" and four identity fields, with no cancellation terms, no reviews and no mention that a
 * deposit is possible — while asking for 100% by card. Every OTA listing this property competes with
 * shows all three. Someone comparing the two is not being asked to choose between a price and a
 * price; they are choosing between a page that answers "what if I have to cancel" and one that does
 * not.
 *
 * DEGRADES TO NOTHING, PIECE BY PIECE. No policy configured, no policy line. No usable review, no
 * quote. No phone on the property, no deposit line — because the deposit is arranged by talking, and
 * promising one with no way to reach anybody would be the fabrication this file exists to avoid.
 * A property with none of the three renders nothing at all rather than an empty card.
 *
 * MULTI-PROPERTY. Everything arrives as props resolved server-side from that property's own
 * documents. Nothing here knows which property it is rendering.
 */
"use client";

import React from 'react';
import { Star, ShieldCheck, Wallet } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

export interface BookingReassuranceReview {
  author: string;
  rating: number;
  text: string;
  source: string;
}

export interface BookingReassuranceProps {
  /** Already resolved to the page's language server-side — this component does no translation of it. */
  cancellationPolicy?: string | null;
  /** `{ average, count }` from the property document. Hidden when the count is 0. */
  ratings?: { average: number; count: number } | null;
  review?: BookingReassuranceReview | null;
  /** Whether a deposit conversation is actually reachable. False when the property has no phone. */
  canArrangeDeposit?: boolean;
  className?: string;
}

export function BookingReassurance({
  cancellationPolicy,
  ratings,
  review,
  canArrangeDeposit = false,
  className = '',
}: BookingReassuranceProps) {
  const { t } = useLanguage();

  const hasRating = !!ratings && ratings.count > 0;
  if (!cancellationPolicy && !hasRating && !review && !canArrangeDeposit) return null;

  return (
    <div className={`space-y-4 rounded-card border bg-muted/30 p-4 sm:p-5 ${className}`}>
      {cancellationPolicy && (
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('booking.cancellationTitle', 'Cancellation')}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{cancellationPolicy}</p>
          </div>
        </div>
      )}

      {canArrangeDeposit && (
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('booking.depositTitle', 'Paying')}
            </p>
            {/* The page asks for 100% by card. Every direct booking this property has ever taken was
                ~50% by transfer, arranged in conversation — so saying so is describing what already
                happens, not offering something new. */}
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {t('booking.depositBody', 'Pay in full by card, or arrange a 50% deposit by bank transfer over WhatsApp or the phone.')}
            </p>
          </div>
        </div>
      )}

      {(hasRating || review) && (
        <div className="flex items-start gap-3">
          <Star className="mt-0.5 h-4 w-4 flex-shrink-0 fill-amber-400 text-amber-400" aria-hidden />
          <div className="min-w-0">
            {hasRating && (
              <p className="text-sm font-semibold text-foreground">
                {ratings!.average.toFixed(1)}
                <span className="font-normal text-muted-foreground">
                  {' '}· {ratings!.count} {t('booking.reviewsWord', 'reviews')}
                </span>
              </p>
            )}
            {review && (
              // Quoted, not paraphrased, and attributed. `lang` is deliberately absent: the review's
              // language is detected, never asserted, and a wrong lang attribute would mislead a
              // screen reader more than none at all.
              <blockquote className="mt-1 text-sm italic leading-relaxed text-muted-foreground">
                “{review.text}”
                <footer className="mt-1 not-italic text-xs text-muted-foreground/80">
                  — {review.author}
                </footer>
              </blockquote>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
