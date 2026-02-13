'use client';

import { useState } from 'react';
import { Star, StarHalf, ChevronDown, ChevronUp, UserCircle, ThumbsUp, ThumbsDown, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import type { RichReview } from '@/types';

interface ReviewCardProps {
  review: RichReview;
}

function renderStars(rating: number, size: 'sm' | 'md' = 'md') {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  const stars = [];
  const cls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={`full-${i}`} className={cn(cls, 'text-amber-400 fill-amber-400')} />);
  }
  if (halfStar) {
    stars.push(<StarHalf key="half" className={cn(cls, 'text-amber-400 fill-amber-400')} />);
  }
  for (let i = 0; i < emptyStars; i++) {
    stars.push(<Star key={`empty-${i}`} className={cn(cls, 'text-amber-200 fill-amber-200')} />);
  }
  return stars;
}

function formatSourceLabel(source: string): string {
  if (source === 'booking.com') return 'Booking.com';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function RatingBar({ label, value, maxValue = 5 }: { label: string; value: number; maxValue?: number }) {
  const percentage = (value / maxValue) * 100;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 text-right text-muted-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

export function ReviewCard({ review }: ReviewCardProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isBookingCom = review.source === 'booking.com';
  const isAirbnb = review.source === 'airbnb';
  const hasSubRatings = review.subRatings && Object.keys(review.subRatings).length > 0;
  const hasAdditionalRatings = review.additionalRatings && Object.keys(review.additionalRatings).length > 0;
  const hasTags = review.tags && Object.keys(review.tags).length > 0;
  const hasDetails = hasSubRatings || hasAdditionalRatings || hasTags;

  const commentText = review.comment || '';
  const isLong = commentText.length > 300;
  const displayComment = isLong && !expanded ? commentText.slice(0, 300) + '...' : commentText;

  const reviewDate = (() => {
    if (!review.date) return undefined;
    if (typeof review.date === 'string') {
      return new Date(review.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    }
    return undefined;
  })();

  return (
    <Card className="flex flex-col border-border">
      <CardContent className="p-5 flex-grow flex flex-col gap-3">
        {/* Header: avatar, name, source, rating */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
            <UserCircle className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{review.guestName}</span>
              {review.source && review.source !== 'direct' && review.source !== 'manual' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {formatSourceLabel(review.source)}
                </Badge>
              )}
              {review.guestCountry && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Globe className="h-3 w-3" />
                  {review.guestCountry}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex">{renderStars(review.rating, 'sm')}</div>
              {reviewDate && <span className="text-xs text-muted-foreground">{reviewDate}</span>}
            </div>
          </div>
        </div>

        {/* Title (Booking.com) */}
        {review.title && (
          <p className="font-medium text-foreground">{review.title}</p>
        )}

        {/* Translation note */}
        {review.translatedFrom && (
          <p className="text-xs text-muted-foreground italic">
            {t('reviews.translatedFrom', 'Translated from')} {review.translatedFrom}
          </p>
        )}

        {/* Positive/Negative split (Booking.com) */}
        {(review.positiveReview || review.negativeReview) ? (
          <div className="space-y-2">
            {review.positiveReview && (
              <div className="flex gap-2">
                <ThumbsUp className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{review.positiveReview}</p>
              </div>
            )}
            {review.negativeReview && (
              <div className="flex gap-2">
                <ThumbsDown className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{review.negativeReview}</p>
              </div>
            )}
          </div>
        ) : commentText ? (
          <div>
            <p className="text-sm text-muted-foreground">
              &quot;{displayComment}&quot;
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-primary font-medium mt-1 flex items-center gap-0.5 hover:underline"
              >
                {expanded ? t('reviews.showLess', 'Show less') : t('reviews.readMore', 'Read more')}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
        ) : null}

        {/* Owner response */}
        {review.ownerResponse && (
          <div className="bg-muted/50 rounded-md p-3 mt-1">
            <p className="text-xs font-semibold text-foreground mb-1">
              {t('reviews.ownerResponse', 'Owner response')}
            </p>
            <p className="text-xs text-muted-foreground">{review.ownerResponse.comment}</p>
          </div>
        )}

        {/* Expandable sub-ratings & tags */}
        {hasDetails && (
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
            >
              {showDetails ? t('reviews.hideDetails', 'Hide details') : t('reviews.showDetails', 'Show details')}
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showDetails && (
              <div className="mt-3 space-y-3">
                {/* Sub-ratings (Airbnb 1-5 scale) */}
                {hasSubRatings && (
                  <div className="space-y-1.5">
                    {Object.entries(review.subRatings!).map(([key, value]) => (
                      <RatingBar key={key} label={key} value={value} maxValue={5} />
                    ))}
                  </div>
                )}

                {/* Additional ratings (Booking.com 1-10 scale) */}
                {hasAdditionalRatings && (
                  <div className="space-y-1.5">
                    {Object.entries(review.additionalRatings!).map(([key, value]) => (
                      <RatingBar key={key} label={key} value={value} maxValue={10} />
                    ))}
                  </div>
                )}

                {/* Tags as badges */}
                {hasTags && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(review.tags!).flatMap(([category, tagList]) =>
                      tagList.map((tag) => (
                        <Badge key={`${category}-${tag}`} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
