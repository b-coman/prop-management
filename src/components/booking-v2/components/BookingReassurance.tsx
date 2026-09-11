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
import { SafeImage } from '@/components/ui/safe-image';
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
  /**
   * The property's hero image. The booking route has always fetched this and passed it to
   * BookingPageV2, which never rendered it — a Firestore read paid for on every page load and thrown
   * away. It belongs here rather than at the top of the page: above the form it would push the form
   * below the fold, which is the mistake the landing hero already made once. Down here it costs no
   * fold space and turns a terms card into somewhere you might actually stay.
   */
  heroImage?: string | null;
  className?: string;
}

export function BookingReassurance({
  cancellationPolicy,
  ratings,
  review,
  canArrangeDeposit = false,
  heroImage,
  className = '',
}: BookingReassuranceProps) {
  const { t } = useLanguage();

  const hasRating = !!ratings && ratings.count > 0;
  if (!cancellationPolicy && !hasRating && !review && !canArrangeDeposit) return null;

  return (
    <div className={`overflow-hidden rounded-card border bg-muted/30 ${className}`}>
      {heroImage && (
        // 3:1 — wide enough to read as a photograph of a place, short enough that it costs a glance
        // rather than a scroll. `sizes` matches the real render widths: full-bleed on a phone, the
        // left column from lg up. `alt=""` because the surrounding copy already says what this is;
        // a decorative repeat of the property name would only add noise to a screen reader.
        <div className="relative aspect-[3/1] w-full">
          <SafeImage src={heroImage} alt="" fill className="object-cover" sizes="(min-width: 1024px) 40vw, 100vw" />
        </div>
      )}

      <div className="space-y-4 p-4 sm:p-5">
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
              {/* The page asks for 100% by card. Every direct booking this property has ever taken
                  was ~50% by transfer, arranged in conversation — so saying so describes what
                  already happens rather than offering something new. */}
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
                // Quoted, not paraphrased, and attributed. `lang` is deliberately absent: the
                // review's language is detected, never asserted, and a wrong lang attribute would
                // mislead a screen reader more than none at all.
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
    </div>
  );
}
