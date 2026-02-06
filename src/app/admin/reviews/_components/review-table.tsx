'use client';

import * as React from 'react';
import type { Review, SerializableTimestamp } from '@/types';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Star, StarHalf, Eye, CheckCircle, EyeOff, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useRowSelection } from '@/hooks/use-row-selection';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import type { BulkAction } from '@/components/admin/BulkActionBar';
import { bulkPublishReviews, bulkUnpublishReviews, bulkDeleteReviews } from '../actions';
import { ReviewDetailDialog } from './review-detail-dialog';

interface ReviewTableProps {
  reviews: Review[];
}

const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    try { return parseISO(dateStr); } catch { return null; }
  }
  if (typeof dateStr === 'number') return new Date(dateStr);
  return null;
};

const renderStars = (rating: number) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const stars = [];

  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={`full-${i}`} className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />);
  }
  if (halfStar) {
    stars.push(<StarHalf key="half" className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />);
  }
  const remaining = 5 - fullStars - (halfStar ? 1 : 0);
  for (let i = 0; i < remaining; i++) {
    stars.push(<Star key={`empty-${i}`} className="h-3.5 w-3.5 text-amber-200 fill-amber-200" />);
  }
  return stars;
};

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  google: 'Google',
  'booking.com': 'Booking.com',
  airbnb: 'Airbnb',
  manual: 'Manual',
};

export function ReviewTable({ reviews }: ReviewTableProps) {
  const [selectedReview, setSelectedReview] = React.useState<Review | null>(null);
  const rowIds = React.useMemo(() => reviews.map(r => r.id), [reviews]);
  const { selectedIds, selectedCount, isSelected, toggle, toggleAll, clearSelection, allState } = useRowSelection(rowIds);

  const bulkActions: BulkAction[] = React.useMemo(() => [
    {
      label: 'Publish',
      icon: CheckCircle,
      variant: 'default' as const,
      onExecute: bulkPublishReviews,
    },
    {
      label: 'Unpublish',
      icon: EyeOff,
      variant: 'default' as const,
      onExecute: bulkUnpublishReviews,
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive' as const,
      confirm: {
        title: 'Delete selected reviews?',
        description: `This will permanently delete ${selectedCount} review(s). Published reviews will affect property ratings.`,
      },
      onExecute: bulkDeleteReviews,
    },
  ], [selectedCount]);

  return (
    <>
      <BulkActionBar
        selectedIds={selectedIds}
        entityName="review(s)"
        actions={bulkActions}
        onClearSelection={clearSelection}
      />
      <Table>
        <TableCaption>Guest reviews across all properties.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allState === 'all' ? true : allState === 'some' ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all reviews"
              />
            </TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => {
            const reviewDate = parseDateSafe(review.date);

            return (
              <TableRow
                key={review.id}
                className="cursor-pointer"
                onClick={() => setSelectedReview(review)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected(review.id)}
                    onCheckedChange={() => toggle(review.id)}
                    aria-label={`Select review by ${review.guestName}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{review.guestName}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{review.propertyId}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    {renderStars(review.rating)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {SOURCE_LABELS[review.source] || review.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={review.isPublished ? 'default' : 'secondary'}
                    className={review.isPublished
                      ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
                      : 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100'
                    }
                  >
                    {review.isPublished ? 'Published' : 'Unpublished'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {reviewDate ? format(reviewDate, 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedReview(review);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ReviewDetailDialog
        review={selectedReview}
        onClose={() => setSelectedReview(null)}
      />
    </>
  );
}
