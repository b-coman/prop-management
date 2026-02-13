'use client';

import { useState, useMemo } from 'react';
import { Star, StarHalf } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { ReviewCard } from '@/components/property/review-card';
import type { RichReview } from '@/types';

interface AggregateStats {
  totalCount: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  sourceBreakdown: Record<string, number>;
}

interface ReviewsListContent {
  title?: string | Record<string, string>;
  showSourceFilter?: boolean;
  showRatingFilter?: boolean;
  showAggregateStats?: boolean;
  reviewsPerPage?: number;
  reviews?: RichReview[];
  aggregateStats?: AggregateStats;
  propertySlug?: string;
}

interface ReviewsListSectionProps {
  content: ReviewsListContent;
  language?: string;
}

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

// Inline bilingual labels — avoids depending on translation keys that may not exist
const labels = {
  review: { en: 'review', ro: 'recenzie' },
  reviews: { en: 'reviews', ro: 'recenzii' },
  noReviews: { en: 'No reviews yet.', ro: 'Nu există recenzii încă.' },
  all: { en: 'All', ro: 'Toate' },
  sortNewest: { en: 'Newest first', ro: 'Cele mai noi' },
  sortOldest: { en: 'Oldest first', ro: 'Cele mai vechi' },
  sortHighest: { en: 'Highest rated', ro: 'Cele mai bune' },
  sortLowest: { en: 'Lowest rated', ro: 'Cele mai slabe' },
  showing: { en: 'Showing', ro: 'Se afișează' },
  of: { en: 'of', ro: 'din' },
  clearFilters: { en: 'Clear filters', ro: 'Șterge filtrele' },
  loadMore: { en: 'Load more reviews', ro: 'Încarcă mai multe recenzii' },
  remaining: { en: 'remaining', ro: 'rămase' },
} as const;

function renderStars(rating: number) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  const stars = [];

  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={`full-${i}`} className="h-5 w-5 text-amber-400 fill-amber-400" />);
  }
  if (halfStar) {
    stars.push(<StarHalf key="half" className="h-5 w-5 text-amber-400 fill-amber-400" />);
  }
  for (let i = 0; i < emptyStars; i++) {
    stars.push(<Star key={`empty-${i}`} className="h-5 w-5 text-amber-200 fill-amber-200" />);
  }
  return stars;
}

function formatSourceLabel(source: string): string {
  if (source === 'booking.com') return 'Booking.com';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function ReviewsListSection({ content }: ReviewsListSectionProps) {
  const { currentLang } = useLanguage();
  const lang = (currentLang === 'ro' ? 'ro' : 'en') as 'en' | 'ro';
  const l = (key: keyof typeof labels) => labels[key][lang];

  const reviews = content?.reviews || [];
  const stats = content?.aggregateStats;
  const showSourceFilter = content?.showSourceFilter !== false;
  const showRatingFilter = content?.showRatingFilter !== false;
  const showAggregateStats = content?.showAggregateStats !== false;
  const perPage = content?.reviewsPerPage || 20;

  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [visibleCount, setVisibleCount] = useState(perPage);

  // Available sources for filter pills
  const sources = useMemo(() => {
    if (!stats?.sourceBreakdown) return [];
    return Object.entries(stats.sourceBreakdown)
      .filter(([source]) => source !== 'direct' && source !== 'manual')
      .sort(([, a], [, b]) => b - a);
  }, [stats?.sourceBreakdown]);

  // Filter and sort reviews
  const filteredReviews = useMemo(() => {
    let result = [...reviews];

    if (sourceFilter) {
      result = result.filter((r) => r.source === sourceFilter);
    }
    if (ratingFilter !== null) {
      result = result.filter((r) => Math.floor(r.rating) === ratingFilter);
    }

    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => {
          const da = typeof a.date === 'string' ? new Date(a.date).getTime() : 0;
          const db = typeof b.date === 'string' ? new Date(b.date).getTime() : 0;
          return da - db;
        });
        break;
      case 'highest':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        result.sort((a, b) => a.rating - b.rating);
        break;
      // 'newest' is the default order from the server
    }

    return result;
  }, [reviews, sourceFilter, ratingFilter, sortBy]);

  const visibleReviews = filteredReviews.slice(0, visibleCount);
  const hasMore = visibleCount < filteredReviews.length;

  if (reviews.length === 0) {
    return (
      <section className="py-10 md:py-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          {l('noReviews')}
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-16">
      <div className="container mx-auto px-4">
        {/* Aggregate Stats */}
        {showAggregateStats && stats && (
          <div className="max-w-2xl mx-auto mb-10">
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-5xl font-bold text-foreground">{stats.averageRating.toFixed(1)}</span>
              <div>
                <div className="flex">{renderStars(stats.averageRating)}</div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stats.totalCount} {stats.totalCount === 1 ? l('review') : l('reviews')}
                </p>
              </div>
            </div>

            {/* Rating distribution bars */}
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.ratingDistribution[star] || 0;
                const pct = stats.totalCount > 0 ? (count / stats.totalCount) * 100 : 0;
                return (
                  <button
                    key={star}
                    onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                    className={cn(
                      "flex items-center gap-2 w-full text-sm hover:opacity-80 transition-opacity rounded px-1 py-0.5",
                      ratingFilter === star && "bg-primary/10"
                    )}
                  >
                    <span className="w-6 text-right text-muted-foreground">{star}</span>
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Source breakdown */}
            {sources.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                {sources.map(([source, count]) => (
                  <span key={source}>
                    {formatSourceLabel(source)}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter pills and sort */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Source filter pills */}
          {showSourceFilter && sources.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSourceFilter(null)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                  sourceFilter === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {l('all')}
              </button>
              {sources.map(([source, count]) => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(sourceFilter === source ? null : source)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                    sourceFilter === source
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {formatSourceLabel(source)} ({count})
                </button>
              ))}
            </div>
          )}

          {/* Rating filter pills */}
          {showRatingFilter && (
            <div className="flex flex-wrap gap-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats?.ratingDistribution[star] || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={star}
                    onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1",
                      ratingFilter === star
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {star}<Star className="h-3 w-3 fill-current" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Sort */}
          <div className="ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground"
            >
              <option value="newest">{l('sortNewest')}</option>
              <option value="oldest">{l('sortOldest')}</option>
              <option value="highest">{l('sortHighest')}</option>
              <option value="lowest">{l('sortLowest')}</option>
            </select>
          </div>
        </div>

        {/* Active filter indicators */}
        {(sourceFilter || ratingFilter !== null) && (
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <span>
              {l('showing')} {filteredReviews.length} {l('of')} {reviews.length} {l('reviews')}
            </span>
            <button
              onClick={() => { setSourceFilter(null); setRatingFilter(null); }}
              className="text-primary hover:underline font-medium"
            >
              {l('clearFilters')}
            </button>
          </div>
        )}

        {/* Review cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((v) => v + perPage)}
            >
              {l('loadMore')} ({filteredReviews.length - visibleCount} {l('remaining')})
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
